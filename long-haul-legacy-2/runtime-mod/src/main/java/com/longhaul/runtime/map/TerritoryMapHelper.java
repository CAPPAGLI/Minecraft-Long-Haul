package com.longhaul.runtime.map;

import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.MapItem;
import net.minecraft.world.level.saveddata.maps.MapItemSavedData;

public final class TerritoryMapHelper {
    private TerritoryMapHelper() {}

    /**
     * Creates a filled_map ItemStack, locks its MapItemSavedData via
     * MapItemSavedData.locked() (SRG m_164775_), paints the 128x128 territory
     * pixels onto the locked instance, and registers it in the level so
     * vanilla terrain mapping (MapItem.update) and Map Atlases never overwrite it.
     */
    public static ItemStack createLockedTerritoryMap(ServerLevel ow, int centerX, int centerZ, int scale, int[] pixels) {
        ItemStack stack = MapItem.m_42886_(ow, centerX, centerZ, (byte) scale, false, false);
        MapItemSavedData data = MapItem.m_42853_(stack, ow);
        if (data == null || pixels == null || pixels.length < 16384) {
            return stack;
        }
        MapItemSavedData lockedData = data.m_164775_();
        for (int pz = 0; pz < 128; pz++) {
            int row = pz * 128;
            for (int px = 0; px < 128; px++) {
                lockedData.m_164803_(px, pz, (byte) (pixels[row + px] & 0xFF));
            }
        }
        Integer mapId = MapItem.m_151131_(stack);
        if (mapId != null) {
            ow.m_142325_(MapItem.m_42848_(mapId), lockedData);
        }
        lockedData.m_77762_();
        return stack;
    }

    public static boolean isLocked(MapItemSavedData data) {
        return data != null && data.f_77890_;
    }

    public static int getColorUnsigned(MapItemSavedData data, int x, int z) {
        if (data == null || data.f_77893_ == null) return -1;
        int idx = x + z * 128;
        if (idx < 0 || idx >= data.f_77893_.length) return -1;
        return data.f_77893_[idx] & 0xFF;
    }
}
