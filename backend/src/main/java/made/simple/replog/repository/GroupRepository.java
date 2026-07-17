package made.simple.replog.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import made.simple.replog.model.Group;

public interface GroupRepository extends JpaRepository<Group, UUID> {
}
