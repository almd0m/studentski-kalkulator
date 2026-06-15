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

Za setup baze koristi:

```text
supabase/current_schema.sql
```

U Supabase dashboardu otvori **SQL Editor**, zalijepi sadrzaj tog fajla i pokreni query. Stari SQL fajlovi su sacuvani u `supabase/legacy/`.

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
