package made.simple.replog.config;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate-limits migration endpoints per client IP using Bucket4j.
 * Two separate buckets: strict for POST /api/migrate, looser for PUT /api/migrate/claim.
 */
public class MigrationRateLimitInterceptor implements HandlerInterceptor {

    private final Map<String, Bucket> migrateBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> claimBuckets = new ConcurrentHashMap<>();

    private final int migrateCapacity;
    private final Duration migratePeriod;
    private final int claimCapacity;
    private final Duration claimPeriod;

    public MigrationRateLimitInterceptor(int migrateCapacity, Duration migratePeriod,
                                         int claimCapacity, Duration claimPeriod) {
        this.migrateCapacity = migrateCapacity;
        this.migratePeriod = migratePeriod;
        this.claimCapacity = claimCapacity;
        this.claimPeriod = claimPeriod;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response,
                             Object handler) throws Exception {
        String ip = getClientIp(request);
        String method = request.getMethod();
        String path = request.getRequestURI();

        ConsumptionProbe probe;
        if ("POST".equalsIgnoreCase(method) && path.equals("/api/migrate")) {
            Bucket bucket = migrateBuckets.computeIfAbsent(ip,
                    k -> createBucket(migrateCapacity, migratePeriod));
            probe = bucket.tryConsumeAndReturnRemaining(1);
        } else if ("PUT".equalsIgnoreCase(method) && path.equals("/api/migrate/claim")) {
            Bucket bucket = claimBuckets.computeIfAbsent(ip,
                    k -> createBucket(claimCapacity, claimPeriod));
            probe = bucket.tryConsumeAndReturnRemaining(1);
        } else {
            return true;
        }

        if (probe.isConsumed()) {
            return true;
        }

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.getWriter().write(""); // empty body, no details
        return false;
    }

    private Bucket createBucket(int capacity, Duration period) {
        return Bucket.builder()
                .addLimit(limit -> limit.capacity(capacity).refillGreedy(capacity, period))
                .build();
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return remoteAddr != null ? remoteAddr : "unknown";
    }
}
