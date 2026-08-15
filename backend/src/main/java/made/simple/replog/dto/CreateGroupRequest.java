package made.simple.replog.dto;

import java.time.Instant;
import java.util.UUID;

public record CreateGroupRequest(
        UUID id,
        String name,
        Integer order,
        Instant createdAt,
        Instant updatedAt
) {}