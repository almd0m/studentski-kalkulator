# Legacy SQL arhiva

Ovaj folder sadrzi stare SQL fajlove iz ranijih faza razvoja aplikacije.

Za novi Supabase projekat ne pokretati fajlove iz ovog foldera. Aktivni setup fajl je:

```text
supabase/current_schema.sql
```

Legacy fajlovi su ostavljeni samo kao istorijska referenca za razvoj i uporedjivanje starih migracija. Neki od njih sadrze staru logiku, ukljucujuci raniju podrsku za `planned` status predmeta, i nisu uskladjeni sa trenutnim proizvodnim tokom.

Ako se azurira postojeca baza iz stare verzije projekta, prvo pregledati `supabase/migrations/` i pokrenuti samo migracije koje odgovaraju stvarnom stanju te baze.
