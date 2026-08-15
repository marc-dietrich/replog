package made.simple.replog.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Full replacement update for an entry (F2). The complete new state is
 * carried — no patch/partial semantics.
 */
public record UpdateEntryRequest(
        LocalDate date,
        BigDecimal weight,
        Integer reps,
        String note,
        Instant createdAt,
        Instant updatedAt) {
}
