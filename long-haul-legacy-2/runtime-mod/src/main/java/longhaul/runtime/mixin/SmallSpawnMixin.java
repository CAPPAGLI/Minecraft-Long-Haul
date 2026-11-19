package longhaul.runtime.mixin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.Constant;
import org.spongepowered.asm.mixin.injection.ModifyConstant;
/** Pinned to the verified Forge 1.20.1 SRG method. Vanilla radius 11 -> 441 chunks.
 * Both constants MUST change together: changing only the ticket can deadlock startup.
 * Does not skip world creation, data loading, save handling, or ordinary chunk loading.
 */
@Mixin(targets="net.minecraft.server.MinecraftServer", remap=false)
public abstract class SmallSpawnMixin {
    private static int radius() {
        return Math.max(1, Math.min(11, Integer.getInteger("longhaul.spawnRadius", 2)));
    }
    @ModifyConstant(method="m_129940_", constant=@Constant(intValue=11), require=1, remap=false)
    private int longhaul$spawnTicketRadius(int vanilla) { return radius(); }
    @ModifyConstant(method="m_129940_", constant=@Constant(intValue=441), require=1, remap=false)
    private int longhaul$spawnChunkTarget(int vanilla) {
        int side=2*radius()-1;
        return side*side;
    }
}
