package longhaul.runtime.mixin;

import longhaul.runtime.xaero.MinimapSectorHighlighter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import xaero.common.minimap.highlight.HighlighterRegistry;

@Mixin(value = HighlighterRegistry.class, remap = false)
public abstract class MinimapRegistryMixin {
    @Inject(method = "end", at = @At("HEAD"))
    private void longhaul$registerMinimapHighlighter(CallbackInfo ci) {
        ((HighlighterRegistry) (Object) this).register(new MinimapSectorHighlighter());
    }
}
