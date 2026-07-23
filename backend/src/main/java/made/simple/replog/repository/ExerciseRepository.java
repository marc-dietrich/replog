package made.simple.replog.repository;

import made.simple.replog.model.Exercise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface ExerciseRepository extends JpaRepository<Exercise, UUID> {

    List<Exercise> findByGroupId(UUID groupId);

    List<Exercise> findByGroupIsNull();

    // ---- Shift innerhalb einer konkreten Group ----
    @Modifying
    @Query("UPDATE Exercise e SET e.order = e.order - 1 WHERE e.group.id = :groupId AND e.order > :oldOrder AND e.order <= :newOrder")
    void shiftDownInGroup(@Param("groupId") UUID groupId, @Param("oldOrder") int oldOrder,
            @Param("newOrder") int newOrder);

    @Modifying
    @Query("UPDATE Exercise e SET e.order = e.order + 1 WHERE e.group.id = :groupId AND e.order >= :newOrder AND e.order < :oldOrder")
    void shiftUpInGroup(@Param("groupId") UUID groupId, @Param("oldOrder") int oldOrder,
            @Param("newOrder") int newOrder);

    // ---- Shift innerhalb "ungrouped" (group IS NULL) ----
    @Modifying
    @Query("UPDATE Exercise e SET e.order = e.order - 1 WHERE e.group IS NULL AND e.order > :oldOrder AND e.order <= :newOrder")
    void shiftDownInUngrouped(@Param("oldOrder") int oldOrder, @Param("newOrder") int newOrder);

    @Modifying
    @Query("UPDATE Exercise e SET e.order = e.order + 1 WHERE e.group IS NULL AND e.order >= :newOrder AND e.order < :oldOrder")
    void shiftUpInUngrouped(@Param("oldOrder") int oldOrder, @Param("newOrder") int newOrder);

    // ---- Für den Fall, dass die Exercise die GROUP wechselt ----

    // Lücke am alten Platz schließen: alles danach in der alten Group rückt um 1
    // vor
    @Modifying
    @Query("UPDATE Exercise e SET e.order = e.order - 1 WHERE e.group.id = :groupId AND e.order > :oldOrder")
    void closeGapInGroup(@Param("groupId") UUID groupId, @Param("oldOrder") int oldOrder);

    @Modifying
    @Query("UPDATE Exercise e SET e.order = e.order - 1 WHERE e.group IS NULL AND e.order > :oldOrder")
    void closeGapInUngrouped(@Param("oldOrder") int oldOrder);

    // Platz am neuen Ziel schaffen: alles ab dort in der neuen Group rückt um 1
    // zurück
    @Modifying
    @Query("UPDATE Exercise e SET e.order = e.order + 1 WHERE e.group.id = :groupId AND e.order >= :newOrder")
    void makeRoomInGroup(@Param("groupId") UUID groupId, @Param("newOrder") int newOrder);

    @Modifying
    @Query("UPDATE Exercise e SET e.order = e.order + 1 WHERE e.group IS NULL AND e.order >= :newOrder")
    void makeRoomInUngrouped(@Param("newOrder") int newOrder);
}