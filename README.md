# StudyFlow — Academic Activity Manager

A local-first React/Vite academic activity and deadline manager.

## Included
- Add subjects
- Add Modules, Tasks, Activities, and Others
- Add descriptions, deadlines and priorities
- Deadline indicator changes automatically:
  - Green: more than 7 days
  - Yellow: 4–7 days
  - Orange: 2–3 days
  - Red: today/tomorrow
  - Overdue: past deadline
- Mark requirements as Submitted with submission timestamp
- Search and filter
- Dashboard statistics
- Subject progress
- File attachment metadata
- Data persists in browser localStorage

## Run
1. Install Node.js (LTS).
2. Open this folder in VS Code.
3. Open Terminal.
4. Run:
   npm install
   npm run dev
5. Open the local URL shown by Vite.

## Important file-upload note
This starter records the selected file names and metadata in browser storage, but it does not upload file bytes to a server. For permanent multi-device uploads, connect Supabase Storage (or another storage provider) and replace the fileChange handler with an upload function.

## Production build
npm run build
# Academic-Activity-Manager-by-Christian
# academicmanagerbychristian
# academicmanagerbychristian
