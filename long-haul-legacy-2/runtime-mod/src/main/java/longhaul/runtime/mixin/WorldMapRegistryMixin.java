package longhaul.runtime.mixin;

import longhaul.runtime.xaero.WorldMapSectorHighlighter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import xaero.map.highlight.HighlighterRegistry;

@Mixin(value = HighlighterRegistry.class, remap = false)
public abstract class WorldMapRegistryMixin {
    @Inject(method = "end", at = @At("HEAD"))
    private void longhaul$registerWorldMapHighlighter(CallbackInfo ci) {
        ((HighlighterRegistry) (Object) this).register(new WorldMapSectorHighlighter());
    }
}
