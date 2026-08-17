package com.arudra.crm.controller;

import com.arudra.crm.entity.Role;
import com.arudra.crm.repository.RoleRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Supplies the role list that the admin Users screen uses to populate its role picker. */
@RestController
@RequestMapping("/api/roles")
@CrossOrigin(origins = "*")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class RoleController {

    private final RoleRepository roleRepository;

    public RoleController(RoleRepository roleRepository) {
        this.roleRepository = roleRepository;
    }

    @GetMapping
    public ResponseEntity<List<String>> getRoles() {
        List<String> names = roleRepository.findAll().stream()
                .map(Role::getName)
                .sorted()
                .toList();
        return ResponseEntity.ok(names);
    }
}
