package made.simple.replog.config;

import made.simple.replog.security.CurrentUserProvider;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Aspect
@Component
@Order(1)
public class RlsAspect {

    @PersistenceContext
    private EntityManager entityManager;

    private final CurrentUserProvider currentUserProvider;

    public RlsAspect(CurrentUserProvider currentUserProvider) {
        this.currentUserProvider = currentUserProvider;
    }

    @Before("execution(* made.simple.replog.service..*(..)) && !execution(* made.simple.replog.service.AuthService.*(..)) && !execution(* made.simple.replog.service.MigrationService.*(..))")
    public void setRlsContext() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth instanceof UsernamePasswordAuthenticationToken)) {
            return;
        }

        try {
            String userId = currentUserProvider.getCurrentUserId().toString();
            entityManager.createNativeQuery("SELECT set_config('app.current_user_id', :userId, true)")
                    .setParameter("userId", userId)
                    .getSingleResult();
        } catch (Exception e) {
            // AuthService may not have a user context — ignore
        }
    }
}