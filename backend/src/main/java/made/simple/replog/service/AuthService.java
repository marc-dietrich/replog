package made.simple.replog.service;

import made.simple.replog.dto.LoginRequest;
import made.simple.replog.dto.RegisterRequest;
import made.simple.replog.dto.UserDto;
import made.simple.replog.model.User;
import made.simple.replog.repository.UserRepository;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public UserDto register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.username())) {
            throw new IllegalArgumentException("Username already taken");
        }

        User user = new User(request.username(), passwordEncoder.encode(request.password()));
        user = userRepository.save(user);

        // Auto-login after registration
        loginInSecurityContext(user);

        return new UserDto(user.getId(), user.getUsername());
    }

    @Transactional(readOnly = true)
    public UserDto login(LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
            .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        loginInSecurityContext(user);

        return new UserDto(user.getId(), user.getUsername());
    }

    public void logout() {
        SecurityContextHolder.clearContext();
    }

    public UserDto getCurrentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof java.util.UUID)) {
            return null;
        }
        java.util.UUID userId = (java.util.UUID) auth.getPrincipal();
        return userRepository.findById(userId)
            .map(u -> new UserDto(u.getId(), u.getUsername()))
            .orElse(null);
    }

    private void loginInSecurityContext(User user) {
        var auth = new UsernamePasswordAuthenticationToken(user.getId(), null, List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
    }
}
