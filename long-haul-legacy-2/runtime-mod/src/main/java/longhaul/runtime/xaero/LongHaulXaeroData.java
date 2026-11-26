package longhaul.runtime.xaero;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.util.HashMap;
import java.util.Map;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.level.Level;

/**
 * Thread-safe client cache of OpenTTD 256x256 sector claims and the active World Border,
 * synced from KubeJS server scripts and rendered natively by Xaero's World Map & Minimap.
 */
public final class LongHaulXaeroData {
    public static final class SectorClaim {
        public final int sx;
        public final int sz;
        public final String dim;
        public final String owner;
        public final String name;
        public final int colorRgb;
        public final String rel;
        public final String bldg;

        public SectorClaim(int sx, int sz, String dim, String owner, String name, int colorRgb, String rel, String bldg) {
            this.sx = sx;
            this.sz = sz;
            this.dim = dim;
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
        public final Map<String, Map<Long, SectorClaim>> claimsByDim;

        public Snapshot(long version, boolean enabled, int borderHalf, String myCid, Map<String, Map<Long, SectorClaim>> claimsByDim) {
            this.version = version;
            this.enabled = enabled;
            this.borderHalf = borderHalf;
            this.myCid = myCid;
            this.claimsByDim = claimsByDim;
        }

        public SectorClaim getClaim(String dimId, int sx, int sz) {
            Map<Long, SectorClaim> m = claimsByDim.get(dimId);
            if (m == null) return null;
            return m.get(packSectorKey(sx, sz));
        }

        public boolean hasDimClaims(String dimId) {
            Map<Long, SectorClaim> m = claimsByDim.get(dimId);
            return m != null && !m.isEmpty();
        }
    }

    private static volatile long seq = 1L;
    private static volatile Snapshot current = new Snapshot(1L, true, 362, "", new HashMap<>());
    private static final ThreadLocal<int[]> THREAD_COLORS = ThreadLocal.withInitial(() -> new int[5]);
    private static final ResourceLocation OVERWORLD_RL = new ResourceLocation("minecraft", "overworld");
    private static volatile ResourceKey<Level> cachedOverworldKey = null;

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

    public static String dimIdOf(ResourceKey<Level> dim) {
        if (dim == null) return "minecraft:overworld";
        ResourceLocation rl = dim.m_135782_();
        return rl != null ? rl.toString() : "minecraft:overworld";
    }

    public static boolean isOverworld(ResourceKey<Level> dim) {
        if (dim == null) return false;
        if (dim == cachedOverworldKey) return true;
        if (OVERWORLD_RL.equals(dim.m_135782_())) {
            cachedOverworldKey = dim;
            return true;
        }
        return false;
    }

    public static boolean isSpawnSanctuarySector(ResourceKey<Level> dim, int sx, int sz) {
        return isOverworld(dim) && Math.abs(sx) <= 1 && Math.abs(sz) <= 1;
    }

    public static void updateFromJson(String json) {
        if (json == null || json.isEmpty()) return;
        try {
            JsonObject root = JsonParser.parseString(json).getAsJsonObject();
            boolean enabled = !root.has("enabled") || root.get("enabled").getAsBoolean();
            int borderHalf = root.has("borderHalf") ? Math.max(32, root.get("borderHalf").getAsInt()) : 362;
            String myCid = root.has("myCid") && !root.get("myCid").isJsonNull() ? root.get("myCid").getAsString() : "";
            Map<String, Map<Long, SectorClaim>> byDim = new HashMap<>();
            if (root.has("claims") && root.get("claims").isJsonArray()) {
                JsonArray arr = root.getAsJsonArray("claims");
                for (JsonElement el : arr) {
                    if (!el.isJsonObject()) continue;
                    JsonObject o = el.getAsJsonObject();
                    int sx = o.has("sx") ? o.get("sx").getAsInt() : 0;
                    int sz = o.has("sz") ? o.get("sz").getAsInt() : 0;
                    String dim = o.has("dim") && !o.get("dim").isJsonNull() ? o.get("dim").getAsString() : "minecraft:overworld";
                    String owner = o.has("owner") ? o.get("owner").getAsString() : "";
                    String name = o.has("name") ? o.get("name").getAsString() : owner;
                    int color = o.has("color") ? o.get("color").getAsInt() : 0xFACC15;
                    String rel = o.has("rel") ? o.get("rel").getAsString() : "neutral";
                    String bldg = o.has("bldg") && !o.get("bldg").isJsonNull() ? o.get("bldg").getAsString() : "";
                    Map<Long, SectorClaim> dm = byDim.computeIfAbsent(dim, k -> new HashMap<>());
                    dm.put(packSectorKey(sx, sz), new SectorClaim(sx, sz, dim, owner, name, color, rel, bldg));
                }
            }
            long nextVer = ++seq;
            current = new Snapshot(nextVer, enabled, borderHalf, myCid, byDim);
            XaeroRefreshBridge.refreshAll();
        } catch (Throwable ignored) {}
    }

    private static boolean isBorderChunk(Snapshot snap, ResourceKey<Level> dim, int cx, int cz) {
        if (!isOverworld(dim)) return false;
        int minC = Math.floorDiv(-snap.borderHalf, 16);
        int maxC = Math.floorDiv(snap.borderHalf - 1, 16);
        if (cx < minC || cx > maxC || cz < minC || cz > maxC) return false;
        return cx == minC || cx == maxC || cz == minC || cz == maxC;
    }

    public static boolean regionHasHighlights(ResourceKey<Level> dim, int rx, int rz) {
        Snapshot snap = current;
        if (!snap.enabled || dim == null) return false;
        String dimId = dimIdOf(dim);
        boolean ow = isOverworld(dim);
        if (!ow && !snap.hasDimClaims(dimId)) return false;

        int minCx = rx << 5;
        int maxCx = minCx + 31;
        int minCz = rz << 5;
        int maxCz = minCz + 31;

        if (ow) {
            int minB = Math.floorDiv(-snap.borderHalf, 16);
            int maxB = Math.floorDiv(snap.borderHalf - 1, 16);
            if (maxCx >= minB && minCx <= maxB && maxCz >= minB && minCz <= maxB) {
                if (minCx <= minB && maxCx >= minB) return true;
                if (minCx <= maxB && maxCx >= maxB) return true;
                if (minCz <= minB && maxCz >= minB) return true;
                if (minCz <= maxB && maxCz >= maxB) return true;
            }
        }

        int minSx = chunkToSector(minCx);
        int maxSx = chunkToSector(maxCx);
        int minSz = chunkToSector(minCz);
        int maxSz = chunkToSector(maxCz);
        for (int sx = minSx; sx <= maxSx; sx++) {
            for (int sz = minSz; sz <= maxSz; sz++) {
                if (isSpawnSanctuarySector(dim, sx, sz)) return true;
                if (snap.getClaim(dimId, sx, sz) != null) return true;
            }
        }
        return false;
    }

    public static boolean chunkIsHighlit(ResourceKey<Level> dim, int cx, int cz) {
        Snapshot snap = current;
        if (!snap.enabled || dim == null) return false;
        if (isBorderChunk(snap, dim, cx, cz)) return true;
        int sx = chunkToSector(cx);
        int sz = chunkToSector(cz);
        return isSpawnSanctuarySector(dim, sx, sz) || snap.getClaim(dimIdOf(dim), sx, sz) != null;
    }

    private static boolean sameCellOwner(Snapshot snap, ResourceKey<Level> dim, String dimId, String ownerOrNull, boolean isSpawn, int cx, int cz) {
        int sx = chunkToSector(cx);
        int sz = chunkToSector(cz);
        SectorClaim cl = snap.getClaim(dimId, sx, sz);
        if (ownerOrNull != null) {
            return cl != null && ownerOrNull.equals(cl.owner);
        }
        return isSpawn && cl == null && isSpawnSanctuarySector(dim, sx, sz);
    }

    public static boolean fillColors(int[] resultStore, ResourceKey<Level> dim, int cx, int cz) {
        Snapshot snap = current;
        if (!snap.enabled || dim == null) return false;
        String dimId = dimIdOf(dim);

        int sx = chunkToSector(cx);
        int sz = chunkToSector(cz);
        SectorClaim cl = snap.getClaim(dimId, sx, sz);
        boolean spawn = (cl == null) && isSpawnSanctuarySector(dim, sx, sz);
        boolean border = isBorderChunk(snap, dim, cx, cz);

        if (cl == null && !spawn && !border) return false;

        int fill = 0;
        int borderCol = 0;
        String meOwner = null;
        if (cl != null) {
            meOwner = cl.owner;
            int fillPct = "self".equals(cl.rel) ? 22 : ("ally".equals(cl.rel) ? 26 : 30);
            fill = packColor(cl.colorRgb, fillPct);
            borderCol = packColor(cl.colorRgb, 96);
        } else if (spawn) {
            fill = packColor(0x60A5FA, 14);
            borderCol = packColor(0x93C5FD, 88);
        } else {
            int borderFill = packColor(0xEF4444, 18);
            int borderEdge = packColor(0xEF4444, 98);
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
        resultStore[1] = sameCellOwner(snap, dim, dimId, meOwner, spawn, cx, cz - 1) ? fill : borderCol;
        resultStore[2] = sameCellOwner(snap, dim, dimId, meOwner, spawn, cx + 1, cz) ? fill : borderCol;
        resultStore[3] = sameCellOwner(snap, dim, dimId, meOwner, spawn, cx, cz + 1) ? fill : borderCol;
        resultStore[4] = sameCellOwner(snap, dim, dimId, meOwner, spawn, cx - 1, cz) ? fill : borderCol;

        if (border) {
            int redEdge = packColor(0xEF4444, 98);
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
        if (!snap.enabled || dim == null) return 0;
        long h = 17L * 37L + snap.version;
        h = h * 37L + dimIdOf(dim).hashCode();
        h = h * 37L + rx;
        h = h * 37L + rz;
        return (int) (h ^ (h >>> 32));
    }

    public static Component tooltip(ResourceKey<Level> dim, int cx, int cz) {
        Snapshot snap = current;
        if (!snap.enabled || dim == null) return null;
        int sx = chunkToSector(cx);
        int sz = chunkToSector(cz);
        SectorClaim cl = snap.getClaim(dimIdOf(dim), sx, sz);
        boolean border = isBorderChunk(snap, dim, cx, cz);
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
        } else if (isSpawnSanctuarySector(dim, sx, sz)) {
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
        // Xaero ChunkHighlighter expects (R << 24) | (G << 16) | (B << 8) | A
        int alpha = Math.max(0, Math.min(255, 255 * opacityPercent / 100));
        return ((rgb & 0xFFFFFF) << 8) | alpha;
    }
}
