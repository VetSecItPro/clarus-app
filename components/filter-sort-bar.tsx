"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Search, ListFilter, ArrowUpDown, XCircle, Tag } from "lucide-react"
import type React from "react"
import { useState, useMemo } from "react"

export interface FilterSortOption {
  value: string
  label: string
  icon?: React.ReactNode // For multi-select options like ratings
}

interface FilterSortBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  searchPlaceholder?: string

  // Single Select Filter (e.g., for Content Type)
  singleFilterLabel?: string
  singleFilterOptions?: FilterSortOption[]
  activeSingleFilter?: string
  onSingleFilterChange?: (value: string) => void
  showClearSingleFilter?: boolean

  // Multi Select Filter (e.g., for Rating Scores)
  multiFilterLabel?: string
  multiFilterOptions?: FilterSortOption[]
  activeMultiFilters?: string[]
  onMultiFilterChange?: (value: string, checked: boolean) => void

  // Tag Filter
  tagFilterOptions?: FilterSortOption[]
  activeTagFilters?: string[]
  onTagFilterChange?: (value: string, checked: boolean) => void

  // Sort
  sortOptions: FilterSortOption[]
  activeSort: string
  onSortChange: (value: string) => void
}

export default function FilterSortBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  singleFilterLabel,
  singleFilterOptions,
  activeSingleFilter,
  onSingleFilterChange,
  showClearSingleFilter = true,
  multiFilterLabel,
  multiFilterOptions,
  activeMultiFilters,
  onMultiFilterChange,
  tagFilterOptions,
  activeTagFilters,
  onTagFilterChange,
  sortOptions,
  activeSort,
  onSortChange,
}: FilterSortBarProps) {
  const hasActiveSingleFilter = activeSingleFilter && activeSingleFilter !== "all"
  const hasActiveMultiFilters = activeMultiFilters && activeMultiFilters.length > 0
  const hasActiveTagFilters = activeTagFilters && activeTagFilters.length > 0

  const [tagSearchQuery, setTagSearchQuery] = useState("")

  const filteredTagOptions = useMemo(() => {
    if (!tagFilterOptions) return []
    return tagFilterOptions.filter((option) => option.label.toLowerCase().includes(tagSearchQuery.toLowerCase()))
  }, [tagFilterOptions, tagSearchQuery])

  return (
    <div className="mb-6 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative w-full sm:flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-3 py-2 h-10 bg-gray-700/50 border-gray-600 text-gray-200 focus:ring-gray-500 placeholder-gray-500 rounded-md"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-gray-400 hover:text-gray-200"
              onClick={() => onSearchChange("")}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(singleFilterOptions || multiFilterOptions) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-10 border-gray-600 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-gray-100"
                >
                  <ListFilter className="mr-2 h-4 w-4" />
                  {singleFilterLabel || multiFilterLabel || "Filter"}
                  {(hasActiveSingleFilter || hasActiveMultiFilters) && (
                    <span className="ml-1.5 h-2 w-2 rounded-full bg-blue-400" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-gray-800 border-gray-700 text-gray-200">
                <DropdownMenuLabel>{singleFilterLabel || multiFilterLabel || "Filter by"}</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-700" />
                {singleFilterOptions && onSingleFilterChange && activeSingleFilter && (
                  <DropdownMenuRadioGroup value={activeSingleFilter} onValueChange={onSingleFilterChange}>
                    {showClearSingleFilter && (
                      <DropdownMenuRadioItem value="all" className="focus:bg-gray-700 data-[state=checked]:bg-gray-600">
                        All
                      </DropdownMenuRadioItem>
                    )}
                    {singleFilterOptions.map((option) => (
                      <DropdownMenuRadioItem
                        key={option.value}
                        value={option.value}
                        className="focus:bg-gray-700 data-[state=checked]:bg-gray-600"
                      >
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                )}
                {multiFilterOptions && onMultiFilterChange && activeMultiFilters && (
                  <>
                    {multiFilterOptions.map((option) => (
                      <DropdownMenuCheckboxItem
                        key={option.value}
                        checked={activeMultiFilters.includes(option.value)}
                        onCheckedChange={(checked) => onMultiFilterChange(option.value, !!checked)}
                        className="focus:bg-gray-700 data-[state=checked]:bg-gray-600"
                      >
                        {option.icon && <span className="mr-2">{option.icon}</span>}
                        {option.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {tagFilterOptions && onTagFilterChange && activeTagFilters && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-10 border-gray-600 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-gray-100"
                  disabled={tagFilterOptions.length === 0}
                >
                  <Tag className="mr-2 h-4 w-4" />
                  Tags
                  {hasActiveTagFilters && <span className="ml-1.5 h-2 w-2 rounded-full bg-blue-400" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-60 bg-gray-800 border-gray-700 text-gray-200"
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-between pr-2">
                  <DropdownMenuLabel>Filter by Tags</DropdownMenuLabel>
                  {activeTagFilters.length > 0 && (
                    <button
                      onClick={() => activeTagFilters.forEach((tag) => onTagFilterChange(tag, false))}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <DropdownMenuSeparator className="bg-gray-700" />
                <div className="max-h-60 overflow-y-auto no-scrollbar pr-1">
                  {filteredTagOptions.map((option) => (
                    <DropdownMenuCheckboxItem
                      key={option.value}
                      checked={activeTagFilters.includes(option.value)}
                      onCheckedChange={(checked) => onTagFilterChange(option.value, !!checked)}
                      className="focus:bg-gray-700 data-[state=checked]:bg-gray-600"
                      onSelect={(e) => e.preventDefault()} // Prevent closing on select
                    >
                      {option.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
                <DropdownMenuSeparator className="bg-gray-700 mt-1" />
                <div className="p-2">
                  <Input
                    type="text"
                    placeholder="Filter tags..."
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    className="w-full h-8 bg-gray-900 border-gray-600 text-gray-200 focus:ring-gray-500 placeholder-gray-500 rounded-md"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-auto h-10 border-gray-600 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-gray-100"
              >
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-gray-800 border-gray-700 text-gray-200">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-700" />
              <DropdownMenuRadioGroup value={activeSort} onValueChange={onSortChange}>
                {sortOptions.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    className="focus:bg-gray-700 data-[state=checked]:bg-gray-600"
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
