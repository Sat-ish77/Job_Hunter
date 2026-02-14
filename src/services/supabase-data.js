// src/services/supabase-data.js
//
// Supabase Data Access Layer
// ===========================
// This module provides a clean API for CRUD operations on all database tables.
// It replaces the Base44 SDK's entity system with direct Supabase PostgREST queries.
//
// ARCHITECTURE DECISION: Why a service layer instead of raw supabase calls?
// 1. Single place to change if we switch databases (e.g., Supabase -> PlanetScale)
// 2. Consistent error handling across all data operations
// 3. Easier to add caching, logging, or optimistic updates later
// 4. Keeps components focused on UI, not data fetching details
// 5. Mirrors the Base44 `entities.EntityName.method()` API so existing pages
//    need minimal changes during migration
//
// HOW SUPABASE QUERIES WORK (PostgREST under the hood):
// - supabase.from('table')       -> starts a query builder for that table
// - .select('*')                 -> SELECT * (which columns to return)
// - .eq('field', value)          -> WHERE field = value
// - .order('field', { ascending: false }) -> ORDER BY field DESC
// - .limit(n)                    -> LIMIT n
// - .insert(data)                -> INSERT INTO table VALUES (data)
// - .update(data).eq('id', id)   -> UPDATE table SET ... WHERE id = id
// - .delete().eq('id', id)       -> DELETE FROM table WHERE id = id
// - .single()                    -> returns one object instead of an array
//
// ROW LEVEL SECURITY (RLS):
// All tables have RLS policies that automatically filter by the authenticated
// user's ID. So `supabase.from('jobs').select('*')` only returns the current
// user's jobs -- no need to manually filter by user_id in most queries.
// This is enforced at the Postgres level, so it's impossible to bypass from
// the client side.
//
// FIELD NAME MAPPING:
// Base44 used slightly different field names than our Supabase schema.
// For example, Base44's `created_date` became `created_at` in Postgres,
// The SORT_FIELD_MAP below handles this translation transparently.
// NOTE: `score_total` is the canonical Postgres column name (no remapping).
//
// USAGE (how pages consume this module):
//   import { base44 } from '@/api/base44Client';  // old import stays
//   // But now base44.entities is powered by these service objects:
//   const jobs = await base44.entities.Job.list('-created_date', 200);
//
//   OR import directly:
//   import { JobService } from '@/services/supabase-data';
//   const jobs = await JobService.list('-created_date', 200);
//
//   OR use the convenience db object:
//   import { db } from '@/services/supabase-data';
//   const jobs = await db.jobs.list('-created_date', 200);

import { supabase } from '@/api/base44Client';

// =============================================================================
// SORT FIELD MAPPING
// =============================================================================
//
// Base44 used certain field names in sort strings (e.g., '-created_date').
// Our Supabase Postgres schema uses different column names for some of these.
// This map translates Base44 sort field names to the actual Postgres column names.
//
// HOW IT WORKS:
// - The keys are Base44 field names (what the UI code passes)
// - The values are Supabase/Postgres column names (what the DB actually has)
// - If a field isn't in the map, we use it as-is (identity mapping)
//
// WHY: This lets us change the sort strings in the UI code gradually,
// or keep backward compatibility with the old Base44 naming convention.
const SORT_FIELD_MAP = {
  created_date: 'created_at',    // Base44 used `created_date`, Postgres uses `created_at`
  updated_date: 'updated_at',    // Same pattern for updated timestamps
  // NOTE: score_total IS the correct Postgres column name in job_matches.
  // No mapping needed — the old `overall_score` alias has been removed.
};

// =============================================================================
// HELPER: parseSortString
// =============================================================================
//
// Converts a Base44-style sort string into a Supabase-compatible sort config.
//
// Base44 sort strings use a convention:
//   '-created_date'  -> sort by created_date DESCENDING (the `-` prefix means DESC)
//   'created_date'   -> sort by created_date ASCENDING  (no prefix means ASC)
//   '-score_total'   -> sort by score_total DESCENDING
//
// This function:
// 1. Checks for the `-` prefix to determine sort direction
// 2. Strips the prefix to get the raw field name
// 3. Maps the Base44 field name to the Supabase column name using SORT_FIELD_MAP
// 4. Returns an object that supabase's .order() method can use
//
// PARAMETERS:
//   sortString (string): The Base44-style sort string, e.g., '-created_date'
//
// RETURNS:
//   { column: string, ascending: boolean }
//   e.g., { column: 'created_at', ascending: false }
//
// EXAMPLE:
//   parseSortString('-created_date')
//   // => { column: 'created_at', ascending: false }
//
//   parseSortString('title')
//   // => { column: 'title', ascending: true }
function parseSortString(sortString) {
  // If no sort string provided, default to sorting by created_at descending.
  // This is a sensible default: newest records first.
  if (!sortString) {
    return { column: 'created_at', ascending: false };
  }

  // Check if the string starts with '-' which indicates descending order.
  // This is a common convention in REST APIs (Django REST Framework uses it too).
  const isDescending = sortString.startsWith('-');

  // Strip the '-' prefix if present to get the raw field name.
  // e.g., '-created_date' becomes 'created_date'
  const rawField = isDescending ? sortString.slice(1) : sortString;

  // Look up the field in our mapping table. If it's not there, use the
  // raw field name directly (the `|| rawField` fallback).
  // e.g., 'created_date' -> 'created_at', but 'title' -> 'title' (unmapped)
  const column = SORT_FIELD_MAP[rawField] || rawField;

  return {
    column,                    // The actual Postgres column name
    ascending: !isDescending,  // true = ASC, false = DESC
  };
}

// =============================================================================
// HELPER: handleResponse
// =============================================================================
//
// Every Supabase query returns an object with { data, error, count, status }.
// This helper standardizes how we handle that response across all services:
// - If there's an error, we throw it so React Query can catch it
// - If successful, we return just the data (unwrapping the response)
//
// WHY THROW INSTEAD OF RETURN ERROR?
// React Query (TanStack Query) expects query/mutation functions to throw on
// failure. When a function throws, React Query marks the query as "error" state
// and exposes `error` to the component. If we returned the error instead,
// the query would appear successful with the error object as "data".
//
// PARAMETERS:
//   response (object): The raw Supabase response { data, error }
//   operation (string): A human-readable label for error messages, e.g., 'Job.list'
//
// RETURNS:
//   The `data` property from the Supabase response (an array for .select(),
//   an array of inserted/updated rows for .insert()/.update(), etc.)
//
// THROWS:
//   Error with a descriptive message if the Supabase query failed
function handleResponse(response, operation) {
  // Destructure the Supabase response. `data` is the query result,
  // `error` is null on success or an object with { message, details, hint, code }.
  const { data, error } = response;

  if (error) {
    // Log the full error object for debugging in the browser console.
    // This helps developers see the raw Supabase error with all its fields
    // (message, details, hint, code) when something goes wrong.
    console.error(`[SupabaseData] ${operation} failed:`, error);

    // Throw a new Error so React Query catches it and sets query.error.
    // We include both the operation name and Supabase's error message
    // so the developer knows WHAT failed and WHY.
    throw new Error(`${operation} failed: ${error.message}`);
  }

  // On success, return just the data. Components don't need the status code,
  // count, or other metadata -- they just want the rows.
  return data;
}

// =============================================================================
// SERVICE FACTORY: createService
// =============================================================================
//
// A factory function that generates a service object for a given database table.
// Instead of writing repetitive CRUD code for each of our 7 entities, this
// factory creates the common methods (list, filter, create, update, delete,
// bulkCreate) and returns them as an object.
//
// DESIGN PATTERN: This is the "Factory Pattern" -- a function that creates and
// returns objects. It avoids class inheritance complexity while still providing
// code reuse. Each entity gets the same set of methods, all configured for
// its specific table.
//
// PARAMETERS:
//   tableName  (string): The Postgres table name, e.g., 'jobs', 'applications'
//   entityName (string): A human-readable name for error messages, e.g., 'Job'
//
// RETURNS:
//   An object with these methods:
//     list(sort?, limit?)    -> SELECT with optional ORDER BY and LIMIT
//     filter(conditions)     -> SELECT with WHERE clauses
//     create(data)           -> INSERT one row
//     update(id, data)       -> UPDATE one row by id
//     delete(id)             -> DELETE one row by id
//     bulkCreate(items)      -> INSERT multiple rows at once
//
// Each entity below picks only the methods it needs from this factory output.
// For example, JobMatch only needs list() and filter(), so its service object
// only exposes those two methods.
function createService(tableName, entityName) {
  return {
    // =========================================================================
    // LIST: Fetch all rows with optional sorting and pagination
    // =========================================================================
    //
    // Mirrors Base44's: base44.entities.Entity.list(sortString, limit)
    //
    // PARAMETERS:
    //   sortString (string, optional): Base44-style sort, e.g., '-created_date'
    //   limit      (number, optional): Max number of rows to return
    //
    // SUPABASE QUERY BUILT:
    //   supabase.from('jobs')
    //     .select('*')
    //     .order('created_at', { ascending: false })
    //     .limit(200)
    //
    // RETURNS: Array of row objects, e.g., [{ id: '...', title: '...' }, ...]
    //
    // EXAMPLES (from actual page usage):
    //   JobService.list('-created_date', 200)  -> 200 newest jobs
    //   JobMatchService.list('-score_total', 100) -> 100 highest-scored matches
    //   ApplicationService.list()  -> all applications (no sort, no limit)
    async list(sortString, limit) {
      // Start building the query: SELECT * FROM <tableName>
      let query = supabase.from(tableName).select('*');

      // If a sort string was provided, parse it and add ORDER BY.
      // parseSortString handles the '-' prefix convention and field name mapping.
      if (sortString) {
        const { column, ascending } = parseSortString(sortString);
        // .order() adds ORDER BY to the query.
        // { ascending: true } -> ORDER BY column ASC
        // { ascending: false } -> ORDER BY column DESC
        query = query.order(column, { ascending });
      }

      // If a limit was provided, cap the number of returned rows.
      // This is important for performance -- we don't want to fetch
      // thousands of jobs when the Dashboard only shows 100.
      if (limit) {
        query = query.limit(limit);
      }

      // Execute the query and handle the response.
      // `await query` sends the HTTP request to Supabase's PostgREST API.
      const response = await query;

      // handleResponse will throw if there's an error, or return the data array.
      return handleResponse(response, `${entityName}.list`);
    },

    // =========================================================================
    // FILTER: Fetch rows matching specific field conditions
    // =========================================================================
    //
    // Mirrors Base44's: base44.entities.Entity.filter({ field: value })
    //
    // PARAMETERS:
    //   conditions (object): Key-value pairs for WHERE clauses.
    //     Each key is a column name, each value is the value to match.
    //     e.g., { id: 'abc-123' } becomes WHERE id = 'abc-123'
    //     e.g., { job_id: 'xyz', status: 'saved' } becomes
    //           WHERE job_id = 'xyz' AND status = 'saved'
    //
    // SUPABASE QUERY BUILT:
    //   supabase.from('jobs')
    //     .select('*')
    //     .eq('id', 'abc-123')
    //
    // RETURNS: Array of matching row objects (could be empty if no matches)
    //
    // EXAMPLES (from actual page usage):
    //   JobService.filter({ id: jobId })           -> find one job by ID
    //   GeneratedDocumentService.filter({ job_id: jobId }) -> docs for a job
    async filter(conditions) {
      // Start with SELECT * FROM <tableName>
      let query = supabase.from(tableName).select('*');

      // Loop through each condition and add a .eq() clause.
      // Object.entries() converts { id: 'abc' } into [['id', 'abc']].
      // Each .eq() call adds an AND WHERE clause to the query.
      //
      // NOTE: This only supports equality checks (=). If we later need
      // .gt(), .lt(), .like(), etc., we'd extend this method or add new ones.
      for (const [field, value] of Object.entries(conditions)) {
        query = query.eq(field, value);
      }

      // Execute and unwrap the response.
      const response = await query;
      return handleResponse(response, `${entityName}.filter`);
    },

    // =========================================================================
    // CREATE: Insert a new row into the table
    // =========================================================================
    //
    // Mirrors Base44's: base44.entities.Entity.create({ field: value })
    //
    // PARAMETERS:
    //   data (object): The row data to insert.
    //     e.g., { job_id: 'abc', status: 'saved' }
    //
    // SUPABASE QUERY BUILT:
    //   supabase.from('applications')
    //     .insert({ job_id: 'abc', status: 'saved' })
    //     .select()
    //
    // WHY .select() AFTER .insert()?
    //   By default, Supabase's .insert() returns minimal data (just a status).
    //   Adding .select() tells PostgREST to return the full inserted row(s),
    //   including auto-generated fields like `id`, `created_at`, and `user_id`
    //   (which are set by database defaults and triggers).
    //
    // WHY .single()?
    //   We're inserting one row, so we want one object back -- not an array
    //   with one element. .single() unwraps [{ id: '...' }] into { id: '...' }.
    //
    // RETURNS: The newly created row object with all fields (including generated ones)
    //
    // EXAMPLES (from actual page usage):
    //   ApplicationService.create({ job_id: 'abc', status: 'saved' })
    //   ResumeService.create({ raw_text: '...', target_roles: [...] })
    async create(data) {
      const response = await supabase
        .from(tableName)
        .insert(data)     // INSERT INTO <tableName> (columns...) VALUES (data...)
        .select()         // Return the inserted row (with generated fields)
        .single();        // Return as object, not array

      return handleResponse(response, `${entityName}.create`);
    },

    // =========================================================================
    // UPDATE: Modify an existing row by its ID
    // =========================================================================
    //
    // Mirrors Base44's: base44.entities.Entity.update(id, { field: value })
    //
    // PARAMETERS:
    //   id   (string): The UUID of the row to update
    //   data (object): The fields to update (partial update -- only specified
    //                  fields are changed, others are left untouched)
    //
    // SUPABASE QUERY BUILT:
    //   supabase.from('applications')
    //     .update({ status: 'applied', applied_date: '2025-01-15' })
    //     .eq('id', 'abc-123')
    //     .select()
    //     .single()
    //
    // HOW PARTIAL UPDATES WORK:
    //   Supabase's .update() uses PATCH semantics -- it only modifies the
    //   columns you include in the data object. If you pass { status: 'applied' },
    //   only the `status` column changes; `job_id`, `notes`, etc. stay the same.
    //   This is safe because Postgres UPDATE only sets the specified columns.
    //
    // RETURNS: The full updated row object (all fields, not just the changed ones)
    //
    // EXAMPLES (from actual page usage):
    //   ApplicationService.update('abc-123', { status: 'applied' })
    //   ResumeService.update('def-456', { raw_text: 'new text' })
    //   UserPreferencesService.update('ghi-789', { min_score_threshold: 60 })
    async update(id, data) {
      const response = await supabase
        .from(tableName)
        .update(data)      // SET the specified fields
        .eq('id', id)      // WHERE id = <id> (only update this specific row)
        .select()          // Return the updated row
        .single();         // Return as object, not array

      return handleResponse(response, `${entityName}.update`);
    },

    // =========================================================================
    // DELETE: Remove a row by its ID
    // =========================================================================
    //
    // Mirrors Base44's: base44.entities.Entity.delete(id)
    //
    // PARAMETERS:
    //   id (string): The UUID of the row to delete
    //
    // SUPABASE QUERY BUILT:
    //   supabase.from('applications')
    //     .delete()
    //     .eq('id', 'abc-123')
    //
    // IMPORTANT NOTES:
    // - This is a hard delete (the row is permanently removed from the database).
    //   If we ever need soft deletes, we'd add a `deleted_at` column and use
    //   .update({ deleted_at: new Date() }) instead.
    // - RLS policies ensure users can only delete their own rows. Even if someone
    //   guesses another user's row ID, the delete will fail silently (0 rows affected).
    // - We don't call .select() or .single() here because we don't need the
    //   deleted row's data back. The response will have data: null on success.
    //
    // RETURNS: null (Supabase returns null for delete operations without .select())
    //
    // EXAMPLES (from actual page usage):
    //   ApplicationService.delete('abc-123')
    //   JobSourceService.delete('def-456')
    async delete(id) {
      const response = await supabase
        .from(tableName)
        .delete()          // DELETE FROM <tableName>
        .eq('id', id);     // WHERE id = <id>

      return handleResponse(response, `${entityName}.delete`);
    },

    // =========================================================================
    // BULK CREATE: Insert multiple rows in a single database round-trip
    // =========================================================================
    //
    // Mirrors Base44's: base44.entities.Entity.bulkCreate([item1, item2, ...])
    //
    // PARAMETERS:
    //   items (array of objects): Multiple rows to insert at once.
    //     e.g., [
    //       { name: 'Google Careers', type: 'greenhouse', url: '...' },
    //       { name: 'Meta Careers', type: 'lever', url: '...' },
    //     ]
    //
    // SUPABASE QUERY BUILT:
    //   supabase.from('job_sources')
    //     .insert([{ name: '...' }, { name: '...' }])
    //     .select()
    //
    // WHY BULK INSERT INSTEAD OF MULTIPLE SINGLE INSERTS?
    //   Performance. A single INSERT with 10 rows makes 1 HTTP request.
    //   Ten separate .create() calls would make 10 HTTP requests.
    //   On the Supabase side, it's also a single SQL statement:
    //     INSERT INTO job_sources (name, type, url) VALUES (...), (...), (...)
    //   instead of 10 separate INSERT statements.
    //
    // RETURNS: Array of all newly created row objects (with generated fields)
    //
    // EXAMPLES (from actual page usage):
    //   JobSourceService.bulkCreate([
    //     { name: 'Google', type: 'greenhouse', url: 'https://...' },
    //     { name: 'Meta', type: 'lever', url: 'https://...' },
    //   ])
    async bulkCreate(items) {
      const response = await supabase
        .from(tableName)
        .insert(items)     // INSERT multiple rows at once (array of objects)
        .select();         // Return all inserted rows (no .single() -- we want the array)

      return handleResponse(response, `${entityName}.bulkCreate`);
    },
  };
}

// =============================================================================
// ENTITY SERVICE INSTANCES
// =============================================================================
//
// Each service is created by the factory with the appropriate table name and
// entity label. We then export only the methods that each entity actually uses
// in the codebase. This serves as documentation of which operations are valid
// for each entity, and prevents accidental misuse (e.g., trying to delete a
// JobMatch, which should never happen from the client).
//
// TABLE OF USAGE (gathered from all page files):
// -----------------------------------------------
// Entity             | Methods Used
// -------------------|----------------------------
// Job                | list, filter, create, update, delete
// JobMatch           | list, filter
// Application        | list, create, update, delete
// Resume             | list, create, update
// UserPreferences    | list, create, update
// JobSource          | list, create, delete, bulkCreate
// GeneratedDocument  | filter, create, update
// -----------------------------------------------

// -----------------------------------------------------------------------------
// JOB SERVICE
// -----------------------------------------------------------------------------
// Table: `jobs`
// Stores scraped job postings from various sources (Greenhouse, Lever, etc.).
// Each row represents one job listing with title, company, description, URL, etc.
//
// Used in: Dashboard, Jobs, Pipeline, JobDetail
// Operations: list (sorted/limited), filter by ID, create, update, delete
const jobService = createService('jobs', 'Job');

export const JobService = {
  // Fetch jobs sorted by newest first, limited to N results.
  // Usage: JobService.list('-created_date', 200)
  list: jobService.list,

  // Find a specific job by ID (or any other field).
  // Usage: JobService.filter({ id: jobId })
  // Returns an array -- caller uses [0] to get the single job.
  filter: jobService.filter,

  // Insert a new job row.
  // Usage: JobService.create({ title: '...', company: '...', ... })
  create: jobService.create,

  // Update a job's fields by ID.
  // Usage: JobService.update(id, { status: 'expired' })
  update: jobService.update,

  // Delete a job by ID.
  // Usage: JobService.delete(id)
  delete: jobService.delete,
};

// -----------------------------------------------------------------------------
// JOB MATCH SERVICE
// -----------------------------------------------------------------------------
// Table: `job_matches`
// Stores AI-generated match scores between a user's resume and a job posting.
// Each row links a job_id to a set of scores (score_total, score_breakdown, etc.).
//
// NOTE: JobMatch is read-only from the client. Matches are created by the
// backend scoring pipeline (an Edge Function or background worker), never by
// the user directly. That's why we only expose list() and filter().
//
// Used in: Dashboard, Jobs, Pipeline, JobDetail
// Operations: list (sorted/limited), filter by conditions
const jobMatchService = createService('job_matches', 'JobMatch');

export const JobMatchService = {
  // Fetch matches sorted by score or date, limited to N results.
  // Usage: JobMatchService.list('-score_total', 100)
  // NOTE: '-score_total' maps directly to the `score_total` column in Postgres
  list: jobMatchService.list,

  // Find matches by job_id or other criteria.
  // Usage: JobMatchService.filter({ job_id: 'abc-123' })
  filter: jobMatchService.filter,
};

// -----------------------------------------------------------------------------
// APPLICATION SERVICE
// -----------------------------------------------------------------------------
// Table: `applications`
// Tracks the user's application pipeline. Each row represents a job the user
// has saved, is applying to, has applied to, is interviewing for, etc.
// The `status` field drives the Pipeline kanban board columns.
//
// Used in: Dashboard, Jobs, Pipeline, JobDetail
// Operations: list all, create, update status, delete (unsave)
const applicationService = createService('applications', 'Application');

export const ApplicationService = {
  // Fetch all of the user's applications (RLS scopes to current user).
  // Usage: ApplicationService.list()
  // No sort/limit needed -- users typically have <100 applications.
  list: applicationService.list,

  // Save a job to the pipeline (creates an application with status='saved').
  // Usage: ApplicationService.create({ job_id: 'abc', status: 'saved' })
  create: applicationService.create,

  // Move an application to a new pipeline stage.
  // Usage: ApplicationService.update(id, { status: 'applied', applied_date: '...' })
  update: applicationService.update,

  // Remove a job from the pipeline (unsave it).
  // Usage: ApplicationService.delete(id)
  delete: applicationService.delete,
};

// -----------------------------------------------------------------------------
// RESUME SERVICE
// -----------------------------------------------------------------------------
// Table: `resumes`
// Stores the user's parsed resume data. Currently each user has one resume.
// Contains the raw resume text, extracted skills, target roles, and the
// original file path in Supabase Storage.
//
// Used in: Settings, JobDetail, Onboarding
// Operations: list (get user's resume), create (onboarding), update (settings)
const resumeService = createService('resumes', 'Resume');

export const ResumeService = {
  // Fetch the user's resume(s). Usually returns an array with one element.
  // Usage: const resumes = await ResumeService.list(); const resume = resumes[0];
  list: resumeService.list,

  // Create the initial resume during onboarding.
  // Usage: ResumeService.create({ raw_text: '...', target_roles: [...] })
  create: resumeService.create,

  // Update the resume text or target roles from the Settings page.
  // Usage: ResumeService.update(id, { raw_text: 'updated text' })
  update: resumeService.update,
};

// -----------------------------------------------------------------------------
// USER PREFERENCES SERVICE
// -----------------------------------------------------------------------------
// Table: `user_preferences`
// Stores user-level settings: minimum score threshold, preferred locations,
// remote work preference, sponsorship requirements, etc.
// NOTE: `onboarding_completed` lives in `profiles`, NOT here.
// Like Resume, each user typically has one row.
//
// Used in: Dashboard, Settings, Onboarding
// Operations: list (get prefs), create (onboarding), update (settings)
const userPreferencesService = createService('user_preferences', 'UserPreferences');

export const UserPreferencesService = {
  // Fetch the user's preferences. Returns array (usually one element).
  // Usage: const prefs = await UserPreferencesService.list(); const p = prefs[0];
  list: userPreferencesService.list,

  // Create initial preferences during onboarding.
  // Usage: UserPreferencesService.create({ min_score_threshold: 50, remote_preference: 'none' })
  create: userPreferencesService.create,

  // Update preferences from the Settings page.
  // Usage: UserPreferencesService.update(id, { min_score_threshold: 70 })
  update: userPreferencesService.update,
};

// -----------------------------------------------------------------------------
// JOB SOURCE SERVICE
// -----------------------------------------------------------------------------
// Table: `job_sources`
// Tracks the ATS (Applicant Tracking System) board URLs the user wants to
// scrape for jobs. Each row has a name, type (greenhouse/lever/custom), and URL.
//
// Used in: Dashboard, Jobs, Settings, Onboarding
// Operations: list, create single, delete, bulkCreate (onboarding)
const jobSourceService = createService('job_sources', 'JobSource');

export const JobSourceService = {
  // Fetch all of the user's configured job sources.
  // Usage: JobSourceService.list()
  list: jobSourceService.list,

  // Add a single new job source from the Settings page.
  // Usage: JobSourceService.create({ name: 'Google', type: 'greenhouse', url: '...' })
  create: jobSourceService.create,

  // Remove a job source.
  // Usage: JobSourceService.delete(id)
  delete: jobSourceService.delete,

  // Add multiple job sources at once during onboarding.
  // Usage: JobSourceService.bulkCreate([{ name: '...', type: '...', url: '...' }, ...])
  bulkCreate: jobSourceService.bulkCreate,
};

// -----------------------------------------------------------------------------
// GENERATED DOCUMENT SERVICE
// -----------------------------------------------------------------------------
// Table: `generated_documents`
// Stores AI-generated documents: cover letters, tailored bullet points,
// and answers to application questions. Each document is linked to a specific
// job via `job_id` so the JobDetail page can show all documents for that job.
//
// Used in: JobDetail
// Operations: filter by job_id, create, update
const generatedDocumentService = createService('generated_documents', 'GeneratedDocument');

export const GeneratedDocumentService = {
  // Find all documents for a specific job.
  // Usage: GeneratedDocumentService.filter({ job_id: 'abc-123' })
  filter: generatedDocumentService.filter,

  // Create a new generated document (e.g., after AI generates a cover letter).
  // Usage: GeneratedDocumentService.create({ job_id: 'abc', doc_type: 'cover_letter', content: '...' })
  create: generatedDocumentService.create,

  // Update a document (e.g., after the user edits the AI-generated text).
  // Usage: GeneratedDocumentService.update(id, { content: 'edited text' })
  update: generatedDocumentService.update,
};

// =============================================================================
// CONVENIENCE EXPORT: db
// =============================================================================
//
// A single object that groups all services under short, intuitive names.
// This is handy for ad-hoc queries in components or utility functions where
// you don't want to import each service individually.
//
// USAGE:
//   import { db } from '@/services/supabase-data';
//
//   const jobs = await db.jobs.list('-created_date', 200);
//   const app = await db.applications.create({ job_id: 'abc', status: 'saved' });
//   const docs = await db.generatedDocuments.filter({ job_id: 'abc' });
//
// VS. INDIVIDUAL IMPORTS (also supported):
//   import { JobService, ApplicationService } from '@/services/supabase-data';
//   const jobs = await JobService.list('-created_date', 200);
export const db = {
  jobs: JobService,
  jobMatches: JobMatchService,
  applications: ApplicationService,
  resumes: ResumeService,
  userPreferences: UserPreferencesService,
  jobSources: JobSourceService,
  generatedDocuments: GeneratedDocumentService,
};

// =============================================================================
// DROP-IN REPLACEMENT EXPORT: entities
// =============================================================================
//
// This object mirrors the exact shape of the old `base44.entities` API so that
// existing page code can switch with minimal changes. The pages currently do:
//
//   import { base44 } from '@/api/base44Client';
//   base44.entities.Job.list('-created_date', 200)
//
// By exporting `entities` here with the same entity names, the base44Client.js
// module can re-export it to maintain backward compatibility:
//
//   // In base44Client.js:
//   import { entities } from '@/services/supabase-data';
//   export const base44 = { entities };
//
// This way, none of the page imports need to change during migration.
export const entities = {
  Job: JobService,
  JobMatch: JobMatchService,
  Application: ApplicationService,
  Resume: ResumeService,
  UserPreferences: UserPreferencesService,
  JobSource: JobSourceService,
  GeneratedDocument: GeneratedDocumentService,
};
