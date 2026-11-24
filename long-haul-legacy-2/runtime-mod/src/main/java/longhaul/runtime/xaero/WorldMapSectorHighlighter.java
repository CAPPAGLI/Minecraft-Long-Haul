package longhaul.runtime.xaero;

import java.util.List;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.level.Level;
import xaero.map.highlight.ChunkHighlighter;

/**
 * Renders OpenTTD 256x256 company sectors, the 3x3 spawn sanctuary, and the active
 * World Border directly on Xaero's World Map.
 */
public final class WorldMapSectorHighlighter extends ChunkHighlighter {
    public WorldMapSectorHighlighter() {
        super(true);
    }

    @Override
    public int calculateRegionHash(ResourceKey<Level> dim, int rx, int rz) {
        return LongHaulXaeroData.calculateRegionHash(dim, rx, rz);
    }

    @Override
    public boolean regionHasHighlights(ResourceKey<Level> dim, int rx, int rz) {
        return LongHaulXaeroData.regionHasHighlights(dim, rx, rz);
    }

    @Override
    public boolean chunkIsHighlit(ResourceKey<Level> dim, int cx, int cz) {
        return LongHaulXaeroData.chunkIsHighlit(dim, cx, cz);
    }

    @Override
    protected int[] getColors(ResourceKey<Level> dim, int cx, int cz) {
        return LongHaulXaeroData.fillColors(this.resultStore, dim, cx, cz) ? this.resultStore : null;
    }

    @Override
    public Component getChunkHighlightSubtleTooltip(ResourceKey<Level> dim, int cx, int cz) {
        return LongHaulXaeroData.tooltip(dim, cx, cz);
    }

    @Override
    public Component getChunkHighlightBluntTooltip(ResourceKey<Level> dim, int cx, int cz) {
        return null;
    }

    @Override
    public void addMinimapBlockHighlightTooltips(List<Component> tooltips, ResourceKey<Level> dim, int x, int z, int width) {
        Component c = LongHaulXaeroData.tooltip(dim, x >> 4, z >> 4);
        if (c != null) tooltips.add(c);
    }
}
