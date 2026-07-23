package made.simple.replog.dto;

import java.util.UUID;

public record ReorderGroupsRequest(
    UUID groupId,
    Integer newOrder
) {}