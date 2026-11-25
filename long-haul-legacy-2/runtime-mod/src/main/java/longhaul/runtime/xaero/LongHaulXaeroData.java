package longhaul.runtime.xaero;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.util.HashMap;
import java.util.Map;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.level.Level;

/**
 * Thread-safe client cache of OpenTTD 256x256 sector claims and the active World Border,
 * synced from KubeJS server scripts and rendered natively by Xaero's World Map & Minimap.
 */
public final class LongHaulXaeroData {
    public static final class SectorClaim {
        public final int sx;
        public final int sz;
        public final String owner;
        public final String name;
        public final int colorRgb;
        public final String rel;
        public final String bldg;

        public SectorClaim(int sx, int sz, String owner, String name, int colorRgb, String rel, String bldg) {
            this.sx = sx;
            this.sz = sz;
            this.owner = owner;
            this.name = name;
            this.colorRgb = colorRgb;
            this.rel = rel;
            this.bldg = bldg;
        }
    }

    public static final class Snapshot {
        public final long version;
        public final boolean enabled;
        public final int borderHalf;
        public final String myCid;
        public final Map<Long, SectorClaim> claims;

        public Snapshot(long version, boolean enabled, int borderHalf, String myCid, Map<Long, SectorClaim> claims) {
            this.version = version;
            this.enabled = enabled;
            this.borderHalf = borderHalf;
            this.myCid = myCid;
            this.claims = claims;
        }
    }

    private static volatile long seq = 1L;
    private static volatile Snapshot current = new Snapshot(1L, true, 362, "", new HashMap<>());
    private static final ThreadLocal<int[]> THREAD_COLORS = ThreadLocal.withInitial(() -> new int[5]);

    private LongHaulXaeroData() {}

    public static Snapshot snapshot() {
        return current;
    }

    public static int[] threadColorStore() {
        return THREAD_COLORS.get();
    }

    public static long packSectorKey(int sx, int sz) {
        return (((long) sx) << 32) ^ (sz & 0xFFFFFFFFL);
    }

    public static int chunkToSector(int c) {
        // Matches LHOpenTTD.sectorCoords(x, z): sector (0, 0) spans blocks [-128, 127], i.e. chunks [-8, 7].
        return Math.floorDiv(c + 8, 16);
    }

    public static boolean isOverworld(ResourceKey<Level> dim) {
        return dim != null && dim.toString().contains("minecraft:overworld");
    }

    public static boolean isSpawnSanctuarySector(int sx, int sz) {
        return Math.abs(sx) <= 1 && Math.abs(sz) <= 1;
    }

    public static void updateFromJson(String json) {
        if (json == null || json.isEmpty()) return;
        try {
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            boolean enabled = !root.has("enabled") || root.get("enabled").getAsBoolean();
            int borderHalf = root.has("borderHalf") ? Math.max(32, root.get("borderHalf").getAsInt()) : 362;
            String myCid = root.has("myCid") && !root.get("myCid").isJsonNull() ? root.get("myCid").getAsString() : "";
            Map<Long, SectorClaim> map = new HashMap<>();
            if (root.has("claims") && root.get("claims").isJsonArray()) {
                JsonArray arr = root.getAsJsonArray("claims");
                for (JsonElement el : arr) {
                    if (!el.isJsonObject()) continue;
                    JsonObject o = el.getAsJsonObject();
                    int sx = o.has("sx") ? o.get("sx").getAsInt() : 0;
                    int sz = o.has("sz") ? o.get("sz").getAsInt() : 0;
                    String owner = o.has("owner") ? o.get("owner").getAsString() : "";
                    String name = o.has("name") ? o.get("name").getAsString() : owner;
                    int color = o.has("color") ? o.get("color").getAsInt() : 0xFACC15;
                    String rel = o.has("rel") ? o.get("rel").getAsString() : "neutral";
                    String bldg = o.has("bldg") && !o.get("bldg").isJsonNull() ? o.get("bldg").getAsString() : "";
                    map.put(packSectorKey(sx, sz), new SectorClaim(sx, sz, owner, name, color, rel, bldg));
                }
            }
            long nextVer = ++seq;
            current = new Snapshot(nextVer, enabled, borderHalf, myCid, map);
            XaeroRefreshBridge.refreshAll();
        } catch (Throwable ignored) {}
    }

    private static boolean isBorderChunk(Snapshot snap, int cx, int cz) {
        int minC = Math.floorDiv(-snap.borderHalf, 16);
        int maxC = Math.floorDiv(snap.borderHalf - 1, 16);
        if (cx < minC || cx > maxC || cz < minC || cz > maxC) return false;
        return cx == minC || cx == maxC || cz == minC || cz == maxC;
    }

    public static boolean regionHasHighlights(ResourceKey<Level> dim, int rx, int rz) {
        Snapshot snap = current;
        if (!snap.enabled || !isOverworld(dim)) return false;
        int minCx = rx << 5;
        int maxCx = minCx + 31;
        int minCz = rz << 5;
        int maxCz = minCz + 31;

        int minB = Math.floorDiv(-snap.borderHalf, 16);
        int maxB = Math.floorDiv(snap.borderHalf - 1, 16);
        if (maxCx >= minB && minCx <= maxB && maxCz >= minB && minCz <= maxB) {
            if (minCx <= minB && maxCx >= minB) return true;
            if (minCx <= maxB && maxCx >= maxB) return true;
            if (minCz <= minB && maxCz >= minB) return true;
            if (minCz <= maxB && maxCz >= maxB) return true;
        }

        int minSx = chunkToSector(minCx);
        int maxSx = chunkToSector(maxCx);
        int minSz = chunkToSector(minCz);
        int maxSz = chunkToSector(maxCz);
        for (int sx = minSx; sx <= maxSx; sx++) {
            for (int sz = minSz; sz <= maxSz; sz++) {
                if (isSpawnSanctuarySector(sx, sz)) return true;
                if (snap.claims.containsKey(packSectorKey(sx, sz))) return true;
            }
        }
        return false;
    }

    public static boolean chunkIsHighlit(ResourceKey<Level> dim, int cx, int cz) {
        Snapshot snap = current;
        if (!snap.enabled || !isOverworld(dim)) return false;
        if (isBorderChunk(snap, cx, cz)) return true;
        int sx = chunkToSector(cx);
        int sz = chunkToSector(cz);
        return isSpawnSanctuarySector(sx, sz) || snap.claims.containsKey(packSectorKey(sx, sz));
    }

    private static String cellOwnerId(Snapshot snap, int cx, int cz) {
        int sx = chunkToSector(cx);
        int sz = chunkToSector(cz);
        SectorClaim cl = snap.claims.get(packSectorKey(sx, sz));
        if (cl != null) return "C:" + cl.owner;
        if (isSpawnSanctuarySector(sx, sz)) return "SPAWN";
        return null;
    }

    public static boolean fillColors(int[] resultStore, ResourceKey<Level> dim, int cx, int cz) {
        Snapshot snap = current;
        if (!snap.enabled || !isOverworld(dim)) return false;

        int sx = chunkToSector(cx);
        int sz = chunkToSector(cz);
        SectorClaim cl = snap.claims.get(packSectorKey(sx, sz));
        boolean spawn = (cl == null) && isSpawnSanctuarySector(sx, sz);
        boolean border = isBorderChunk(snap, cx, cz);

        if (cl == null && !spawn && !border) return false;

        int fill = 0;
        int borderCol = 0;
        String me = null;
        if (cl != null) {
            me = "C:" + cl.owner;
            fill = packColor(cl.colorRgb, 24);
            borderCol = packColor(cl.colorRgb, 88);
        } else if (spawn) {
            me = "SPAWN";
            fill = packColor(0x60A5FA, 11);
            borderCol = packColor(0x93C5FD, 72);
        } else {
            // World border ring outside claimed/spawn areas
            int borderFill = packColor(0xEF4444, 14);
            int borderEdge = packColor(0xEF4444, 92);
            int minB = Math.floorDiv(-snap.borderHalf, 16);
            int maxB = Math.floorDiv(snap.borderHalf - 1, 16);
            resultStore[0] = borderFill;
            resultStore[1] = (cz == minB) ? borderEdge : borderFill;
            resultStore[2] = (cx == maxB) ? borderEdge : borderFill;
            resultStore[3] = (cz == maxB) ? borderEdge : borderFill;
            resultStore[4] = (cx == minB) ? borderEdge : borderFill;
            return true;
        }

        resultStore[0] = fill;
        resultStore[1] = me.equals(cellOwnerId(snap, cx, cz - 1)) ? fill : borderCol;
        resultStore[2] = me.equals(cellOwnerId(snap, cx + 1, cz)) ? fill : borderCol;
        resultStore[3] = me.equals(cellOwnerId(snap, cx, cz + 1)) ? fill : borderCol;
        resultStore[4] = me.equals(cellOwnerId(snap, cx - 1, cz)) ? fill : borderCol;

        if (border) {
            int redEdge = packColor(0xEF4444, 92);
            int minB = Math.floorDiv(-snap.borderHalf, 16);
            int maxB = Math.floorDiv(snap.borderHalf - 1, 16);
            if (cz == minB) resultStore[1] = redEdge;
            if (cx == maxB) resultStore[2] = redEdge;
            if (cz == maxB) resultStore[3] = redEdge;
            if (cx == minB) resultStore[4] = redEdge;
        }
        return true;
    }

    public static int calculateRegionHash(ResourceKey<Level> dim, int rx, int rz) {
        Snapshot snap = current;
        if (!snap.enabled || !isOverworld(dim)) return 0;
        long h = 17L * 37L + snap.version;
        h = h * 37L + rx;
        h = h * 37L + rz;
        return (int) (h ^ (h >>> 32));
    }

    public static Component tooltip(ResourceKey<Level> dim, int cx, int cz) {
        Snapshot snap = current;
        if (!snap.enabled || !isOverworld(dim)) return null;
        int sx = chunkToSector(cx);
        int sz = chunkToSector(cz);
        SectorClaim cl = snap.claims.get(packSectorKey(sx, sz));
        boolean border = isBorderChunk(snap, cx, cz);
        String msg = null;
        if (cl != null) {
            String relTxt = "Свободный проход";
            if ("self".equals(cl.rel)) relTxt = "Ваша компания";
            else if ("ally".equals(cl.rel)) relTxt = "Союзник";
            else if ("hostile".equals(cl.rel)) relTxt = "Нет пропуска!";
            msg = cl.name + " (" + sx + ", " + sz + ") [" + relTxt + "]";
            if (cl.bldg != null && !cl.bldg.isEmpty()) {
                msg += " · " + cl.bldg;
            }
        } else if (isSpawnSanctuarySector(sx, sz)) {
            msg = "Зона спауна 3×3 (" + sx + ", " + sz + ")";
        } else if (border) {
            msg = "Граница мира (±" + snap.borderHalf + " м)";
        }
        if (msg == null) return null;
        if (border && cl != null) {
            msg += " · Граница мира";
        }
        // Component.literal(String) -> SRG m_237113_ in Forge 1.20.1
        return Component.m_237113_(msg);
    }

    public static int packColor(int rgb, int opacityPercent) {
        int alpha = Math.max(0, Math.min(255, 255 * opacityPercent / 100));
        return ((rgb & 0xFF) << 24) | (((rgb >> 8) & 0xFF) << 16) | (((rgb >> 16) & 0xFF) << 8) | alpha;
    }
}
