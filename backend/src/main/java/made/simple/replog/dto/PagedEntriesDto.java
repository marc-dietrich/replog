package made.simple.replog.dto;

import java.util.List;
import java.util.UUID;

public record PagedEntriesDto(
        UUID exerciseId,
        List<EntryDto> entries,
        long totalCount,
        int offset,
        int limit) {
}
