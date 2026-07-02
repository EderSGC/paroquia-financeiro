export interface ColumnDefinition {
  name: string;
  type: string;
  default?: string;
  notNull?: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnDefinition[];
}