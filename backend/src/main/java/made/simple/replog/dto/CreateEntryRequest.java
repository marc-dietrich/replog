package made.simple.replog.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CreateEntryRequest(
        LocalDate date,
        BigDecimal weight,
        Integer reps,
        String note,
        UUID exerciseId) {
}
