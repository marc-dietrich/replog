package made.simple.replog.service;

import made.simple.replog.dto.CreateGroupRequest;
import made.simple.replog.dto.EntryDto;
import made.simple.replog.dto.ExerciseDto;
import made.simple.replog.dto.GroupDto;
import made.simple.replog.dto.ReorderGroupsRequest;
import made.simple.replog.dto.UpdateGroupRequest;
import made.simple.replog.model.Entry;
import made.simple.replog.model.Exercise;
import made.simple.replog.model.Group;
import made.simple.replog.repository.ExerciseRepository;
import made.simple.replog.repository.GroupRepository;
import made.simple.replog.security.CurrentUserProvider;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.UUID;

@Service
public class GroupService {

    private final GroupRepository groupRepository;
    private final ExerciseRepository exerciseRepository;
    private final CurrentUserProvider currentUserProvider;

    public GroupService(GroupRepository groupRepository, ExerciseRepository exerciseRepository,
                         CurrentUserProvider currentUserProvider) {
        this.groupRepository = groupRepository;
        this.exerciseRepository = exerciseRepository;
        this.currentUserProvider = currentUserProvider;
    }

    @Transactional(readOnly = true)
    public List<GroupDto> listAll() {
        return listAll(null);
    }

    @Transactional(readOnly = true)
    public List<GroupDto> listAll(Integer entriesLimit) {
        return groupRepository.findAll().stream()
            .map(g -> toDto(g, entriesLimit))
            .toList();
    }

    /**
     * Idempotent create (Q2): a retried create with an already-known client
     * UUID returns the existing entity.
     */
    @Transactional
    public GroupDto create(CreateGroupRequest request) {
        if (request.id() == null) {
            throw new IllegalArgumentException("id (client UUID) is required");
        }
        var existing = groupRepository.findById(request.id());
        if (existing.isPresent()) {
            return toDto(existing.get());
        }

        Group group = new Group();
        group.setId(request.id());
        group.setUserId(currentUserProvider.getCurrentUserId());
        group.setName(request.name());
        group.setOrder(request.order());
        group.setCreatedAt(request.createdAt());
        group.setUpdatedAt(request.updatedAt());

        return toDto(groupRepository.save(group));
    }

    /** Full payload replacement (F2) — also the target of offline reorders (Q4). */
    @Transactional
    public GroupDto update(UUID id, UpdateGroupRequest request) {
        Group group = groupRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Group nicht gefunden: " + id));

        group.setName(request.name());
        group.setOrder(request.order());
        if (request.createdAt() != null) {
            group.setCreatedAt(request.createdAt());
        }
        group.setUpdatedAt(request.updatedAt());

        return toDto(groupRepository.save(group));
    }

    /** Idempotent delete (F1): deleting an already-deleted group is a no-op. */
    @Transactional
    public void delete(UUID id) {
        if (!groupRepository.existsById(id)) {
            return; // target state already reached — no-op, not an error
        }

        List<Exercise> exercises = exerciseRepository.findByGroupId(id);
        exercises.forEach(exercise -> exercise.setGroup(null));
        exerciseRepository.saveAll(exercises);

        groupRepository.deleteById(id);
    }

    @Transactional
    public void reorder(ReorderGroupsRequest request) {
        Group group = groupRepository.findById(request.groupId())
            .orElseThrow(() -> new EntityNotFoundException("Group nicht gefunden: " + request.groupId()));

        int oldOrder = group.getOrder();
        int newOrder = request.newOrder();

        if (oldOrder == newOrder) {
            return;
        }

        if (newOrder > oldOrder) {
            groupRepository.shiftDown(oldOrder, newOrder);
        } else {
            groupRepository.shiftUp(oldOrder, newOrder);
        }

        group.setOrder(newOrder);
        groupRepository.save(group);
    }

    private GroupDto toDto(Group group) {
        return toDto(group, null);
    }

    private GroupDto toDto(Group group, Integer entriesLimit) {
        List<ExerciseDto> exerciseDtos = group.getExercises().stream()
            .map(e -> toDto(e, entriesLimit))
            .toList();
        return new GroupDto(group.getId(), group.getName(), group.getOrder(), exerciseDtos,
                group.getCreatedAt(), group.getUpdatedAt());
    }

    private ExerciseDto toDto(Exercise exercise, Integer entriesLimit) {
        var allEntries = exercise.getEntries().stream()
                .sorted((a, b) -> b.getDate().compareTo(a.getDate()))
                .toList();
        var limitedEntries = (entriesLimit != null && entriesLimit > 0)
                ? allEntries.stream().limit(entriesLimit).toList()
                : allEntries;

        List<EntryDto> entryDtos = limitedEntries.stream()
                .map(this::toDto)
                .toList();
        return new ExerciseDto(exercise.getId(), exercise.getName(), exercise.getOrder(), entryDtos,
                exercise.getGroup() != null ? exercise.getGroup().getId() : null,
                exercise.getCreatedAt(), exercise.getUpdatedAt());
    }

    private EntryDto toDto(Entry entry) {
        return new EntryDto(entry.getId(), entry.getDate(), entry.getWeight(), entry.getReps(), entry.getNote(),
                entry.getCreatedAt(), entry.getUpdatedAt());
    }
}