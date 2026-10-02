package com.arudra.crm.repository;

import com.arudra.crm.entity.ProductNameAlias;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProductNameAliasRepository extends JpaRepository<ProductNameAlias, Long> {
    Optional<ProductNameAlias> findByAlias(String alias);
}
