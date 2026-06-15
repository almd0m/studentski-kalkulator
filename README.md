# Moj Prosjek

React/Vite aplikacija za studentski prosjek, ECTS evidenciju, studijski program, semestre i predmete uz Supabase Auth i bazu.

## Instalacija

```bash
npm install
```

## Pokretanje projekta

```bash
npm run dev
```

Vite ce prikazati lokalni URL, najcesce:

```text
http://127.0.0.1:5173
```

## Environment setup

Napravi `.env.local` u root folderu projekta:

```bash
cp .env.example .env.local
```

Na Windows PowerShell-u mozes koristiti:

```powershell
Copy-Item .env.example .env.local
```

Zatim u `.env.local` unesi javne Supabase vrijednosti:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Vrijednosti se nalaze u Supabase dashboardu pod **Project Settings -> API**.

Nikada ne stavljati `service_role`, secret key ili admin key u frontend aplikaciju. Frontend smije koristiti samo Supabase URL i anon/publishable key.

## Supabase baza

Aktivni setup fajl za novu Supabase bazu je:

```text
supabase/current_schema.sql
```

Za novi clean setup otvori **Supabase SQL Editor**, zalijepi sadrzaj fajla `supabase/current_schema.sql` i pokreni query. Taj fajl predstavlja trenutno kompletno stanje baze koje aplikacija ocekuje.

Folder `supabase/legacy/` je samo istorijska arhiva starih SQL fajlova iz ranijih faza razvoja. Ti fajlovi se ne koriste za nove deploye i ne treba ih pokretati za novi Supabase projekat.

Folder `supabase/migrations/` sadrzi nedestruktivne migracije koje mogu biti korisne samo ako azuriras postojecu bazu iz starije verzije projekta. Za potpuno novu bazu koristi samo `supabase/current_schema.sql`.

## Reset password redirect

Za reset lozinke Supabase mora imati dozvoljen redirect URL.

Lokalno dodaj:

```text
http://127.0.0.1:5173/reset-password
```

Kod deploya dodaj i produkcijski URL, npr:

```text
https://tvoja-domena.com/reset-password
```

To se podesava u Supabase dashboardu pod **Authentication -> URL Configuration**.

## Build provjera

```bash
npm run build
```
