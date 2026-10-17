import { useState, useMemo, type ReactNode } from 'react';
import './DataTable.css';

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: any, row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyState?: ReactNode;
  maxHeight?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  loading,
  emptyState,
  maxHeight,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal === bVal) return 0;
      
      const multiplier = sortOrder === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * multiplier;
      }
      
      return String(aVal).localeCompare(String(bVal)) * multiplier;
    });
  }, [data, sortKey, sortOrder]);

  return (
    <div className="vault-table-container" style={{ maxHeight }}>
      <table className="vault-table">
        <thead>
          <tr className="vault-table-header-row">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`vault-table-th ${col.sortable ? 'sortable' : ''} ${sortKey === col.key ? `sorted-${sortOrder}` : ''}`}
                style={{ width: col.width, textAlign: col.align || 'left' }}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="vault-table-th-content">
                  <span className="text-label-mono-sm color-muted">{col.label}</span>
                  {col.sortable && (
                    <span className="material-symbols-outlined sort-icon">
                      {sortKey === col.key 
                        ? (sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward') 
                        : 'unfold_more'}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="vault-table-body">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="vault-table-row skeleton">
                {columns.map((col) => (
                  <td key={col.key} className="vault-table-td">
                    <div className="vault-skeleton-line" />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="vault-table-empty">
                {emptyState || (
                  <div className="text-label-mono-sm color-muted">NO_RECORDS_FOUND</div>
                )}
              </td>
            </tr>
          ) : (
            sortedData.map((row, idx) => (
              <tr
                key={row.id || idx}
                className={`glass-row vault-table-row ${onRowClick ? 'clickable' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="vault-table-td"
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {col.render 
                      ? col.render(row[col.key], row) 
                      : (
                        <span className="text-body truncate">
                          {row[col.key]?.toString() || '—'}
                        </span>
                      )
                    }
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
