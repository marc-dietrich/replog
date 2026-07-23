package made.simple.replog.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import made.simple.replog.model.Group;

public interface GroupRepository extends JpaRepository<Group, UUID> {

    @Modifying
    @Query("UPDATE Group g SET g.order = g.order - 1 WHERE g.order > :oldOrder AND g.order <= :newOrder")
    void shiftDown(int oldOrder, int newOrder);

    @Modifying
    @Query("UPDATE Group g SET g.order = g.order + 1 WHERE g.order >= :newOrder AND g.order < :oldOrder")
    void shiftUp(int oldOrder, int newOrder);
}
