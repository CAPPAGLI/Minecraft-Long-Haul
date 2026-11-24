package longhaul.runtime.xaero;

import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.level.Level;
import xaero.common.minimap.highlight.ChunkHighlighter;
import xaero.hud.minimap.info.render.compile.InfoDisplayCompiler;

/**
 * Renders OpenTTD 256x256 company sectors, the 3x3 spawn sanctuary, and the active
 * World Border directly on Xaero's Minimap.
 */
public final class MinimapSectorHighlighter extends ChunkHighlighter {
    public MinimapSectorHighlighter() {
        super(true);
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

    public void addBlockHighlightTooltips(InfoDisplayCompiler compiler, ResourceKey<Level> dim, int x, int z, int width) {
        Component c = LongHaulXaeroData.tooltip(dim, x >> 4, z >> 4);
        if (c != null) compiler.addLine(c);
    }

    public void addChunkHighlightTooltips(InfoDisplayCompiler compiler, ResourceKey<Level> dim, int cx, int cz, int width) {
        Component c = LongHaulXaeroData.tooltip(dim, cx, cz);
        if (c != null) compiler.addLine(c);
    }
}
