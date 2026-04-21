// src/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── LIVRES ───────────────────────────────────────────────────

// Récupérer tous les livres actifs
export async function getBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('status', 'actif')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

// Récupérer tous les livres (pour l'admin)
export async function getAllBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); return []; }
  return data;
}

// Ajouter un livre
export async function addBook(book) {
  const { data, error } = await supabase
    .from('books')
    .insert([book])
    .select();
  if (error) { console.error(error); return null; }
  return data[0];
}

// Modifier un livre
export async function updateBook(id, updates) {
  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) { console.error(error); return null; }
  return data[0];
}

// Supprimer un livre
export async function deleteBookDB(id) {
  const { error } = await supabase
    .from('books')
    .delete()
    .eq('id', id);
  if (error) { console.error(error); return false; }
  return true;
}
