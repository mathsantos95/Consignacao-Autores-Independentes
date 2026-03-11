export interface Author {
  id: number;
  name: string;
  phone: string;
  email: string;
  pix_key: string;
  notes: string;
  created_at: string;
}

export interface Book {
  id: number;
  title: string;
  isbn: string;
  author_id: number;
  author_name?: string;
  cover_price: number;
  repasse_type: 'fixed' | 'percent';
  repasse_value: number;
  category: string;
  notes: string;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  title: string;
  author_name: string;
  received: number;
  sold: number;
  returned: number;
  stock: number;
}

export interface Sale {
  id: number;
  book_id: number;
  title?: string;
  author_name?: string;
  quantity: number;
  sale_price: number;
  sale_date: string;
  channel: string;
  reference: string;
  notes: string;
  responsible: string;
  settlement_id: number | null;
}

export interface Settlement {
  id: number;
  author_id: number;
  author_name: string;
  pix_key: string;
  start_date: string;
  end_date: string;
  total_gross: number;
  total_repasse: number;
  status: 'pending' | 'paid';
  payment_date: string | null;
  payment_method: string | null;
  notes: string;
  created_at: string;
}

export interface Consignment {
  id: number;
  book_id: number;
  title: string;
  author_name: string;
  quantity: number;
  entry_date: string;
  notes: string;
  responsible: string;
  created_at: string;
}

export interface Return {
  id: number;
  book_id: number;
  title: string;
  author_name: string;
  quantity: number;
  return_date: string;
  reason: string;
  responsible: string;
  created_at: string;
}
