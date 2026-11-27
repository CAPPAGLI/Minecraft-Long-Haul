package longhaul.runtime.mixin;

import java.util.Map;
import longhaul.runtime.util.YabnFastHelper;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Pseudo;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Pseudo
@Mixin(targets = "com.teamresourceful.yabn.elements.YabnObject", remap = false)
public abstract class YabnObjectFastMixin {
    @Shadow @Final private Map<?, ?> elements;

    @Inject(method = "toData", at = @At("HEAD"), cancellable = true, require = 0)
    private void longhaul$fastToData(CallbackInfoReturnable<byte[]> cir) {
        byte[] fast = YabnFastHelper.encodeObject(this, this.elements);
        if (fast != null) {
            cir.setReturnValue(fast);
        }
    }
}
