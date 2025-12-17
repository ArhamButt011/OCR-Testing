// src/app/admin/hooks/useTemplateFilters.ts
"use client";

import { useState, useMemo } from 'react';
import type { Template, SortField, SortDirection }from '@/app/components/templates';


export const useTemplateFilters = (templates: Template[]) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortField, setSortField] = useState<SortField>('template_id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesStatus = filterStatus === 'all' || template.status === filterStatus;
      const matchesCategory = filterCategory === 'all' || template.category === filterCategory;
      const matchesSearch = searchQuery === '' || 
        template.template_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.template_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesStatus && matchesCategory && matchesSearch;
    });
  }, [templates, filterStatus, filterCategory, searchQuery]);

  // Sort templates
  const sortedTemplates = useMemo(() => {
    const sorted = [...filteredTemplates];
    
    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'template_id':
          aValue = a.template_id;
          bValue = b.template_id;
          break;
        case 'template_name':
          aValue = a.template_name;
          bValue = b.template_name;
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'documents_processed':
          aValue = a.metadata.usage_count || 0;
          bValue = b.metadata.usage_count || 0;
          break;
        case 'accuracy_rate':
          aValue = a.metadata.success_rate || 0;
          bValue = b.metadata.success_rate || 0;
          break;
        default:
          aValue = a.template_id;
          bValue = b.template_id;
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      }
    });

    return sorted;
  }, [filteredTemplates, sortField, sortDirection]);

  // Paginate templates
  const paginatedTemplates = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedTemplates.slice(startIndex, endIndex);
  }, [sortedTemplates, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedTemplates.length / itemsPerPage);

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Handle search change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  // Handle filter changes
  const handleStatusChange = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const handleCategoryChange = (category: string) => {
    setFilterCategory(category);
    setCurrentPage(1);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (items: number) => {
    setItemsPerPage(items);
    setCurrentPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterCategory('all');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || filterStatus !== 'all' || filterCategory !== 'all';

  return {
    // State
    searchQuery,
    filterStatus,
    filterCategory,
    sortField,
    sortDirection,
    currentPage,
    itemsPerPage,
    
    // Computed
    filteredTemplates,
    sortedTemplates,
    paginatedTemplates,
    totalPages,
    hasActiveFilters,
    
    // Handlers
    handleSort,
    handleSearchChange,
    handleStatusChange,
    handleCategoryChange,
    setCurrentPage,
    handleItemsPerPageChange,
    clearFilters,
  };
};