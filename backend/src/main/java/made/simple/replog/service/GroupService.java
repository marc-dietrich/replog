package made.simple.replog.service;

import made.simple.replog.dto.CreateGroupRequest;
import made.simple.replog.dto.EntryDto;
import made.simple.replog.dto.ExerciseDto;
import made.simple.replog.dto.GroupDto;
import made.simple.replog.dto.ReorderGroupsRequest;
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
        return groupRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public GroupDto create(CreateGroupRequest request) {
        Group group = new Group();
        group.setUserId(currentUserProvider.getCurrentUserId());
        group.setName(request.name());
        group.setOrder(request.order());

        return toDto(groupRepository.save(group));
    }

    @Transactional
    public void delete(UUID id) {
        Group group = groupRepository.findById(id)
            .orElseThrow(() -> new EntityNotFoundException("Group nicht gefunden: " + id));

        List<Exercise> exercises = exerciseRepository.findByGroupId(id);
        exercises.forEach(exercise -> exercise.setGroup(null));
        exerciseRepository.saveAll(exercises);

        groupRepository.delete(group);
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
        List<ExerciseDto> exerciseDtos = group.getExercises().stream()
            .map(this::toDto)
            .toList();
        return new GroupDto(group.getId(), group.getName(), group.getOrder(), exerciseDtos);
    }

    private ExerciseDto toDto(Exercise exercise) {
        List<EntryDto> entryDtos = exercise.getEntries().stream()
            .map(this::toDto)
            .toList();
        return new ExerciseDto(exercise.getId(), exercise.getName(), exercise.getOrder(), entryDtos, exercise.getGroup() != null ? exercise.getGroup().getId() : null);
    }

    private EntryDto toDto(Entry entry) {
        return new EntryDto(entry.getId(), entry.getDate(), entry.getWeight(), entry.getReps(), entry.getNote());
    }
}