package made.simple.replog.dto;

import java.time.Instant;

/**
 * Full replacement update for a group (F2). The complete new state is
 * carried — no patch/partial semantics. Also used for offline reorders,
 * which are plain `update` ops with the full new state (Q4).
 */
public record UpdateGroupRequest(
        String name,
        Integer order,
        Instant createdAt,
        Instant updatedAt) {
}
