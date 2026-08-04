package made.simple.replog.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.Duration;

@Configuration
public class RateLimitConfig implements WebMvcConfigurer {

    @Value("${app.migration.rate-limit.migrate-capacity:10}")
    private int migrateCapacity;

    @Value("${app.migration.rate-limit.migrate-period-hours:1}")
    private int migratePeriodHours;

    @Value("${app.migration.rate-limit.claim-capacity:15}")
    private int claimCapacity;

    @Value("${app.migration.rate-limit.claim-period-minutes:1}")
    private int claimPeriodMinutes;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new MigrationRateLimitInterceptor(
                migrateCapacity,
                Duration.ofHours(migratePeriodHours),
                claimCapacity,
                Duration.ofMinutes(claimPeriodMinutes)
        )).addPathPatterns("/api/migrate", "/api/migrate/claim");
    }
}
