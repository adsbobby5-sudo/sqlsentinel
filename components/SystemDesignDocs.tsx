
import React from 'react';
import { 
  ShieldCheck, 
  Server, 
  Database, 
  Lock, 
  Code, 
  ArrowRightLeft,
  Terminal,
  FileJson
} from 'lucide-react';

const SystemDesignDocs: React.FC = () => {
  return (
    <div className="flex-1 bg-white overflow-y-auto p-10 font-sans max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">System Design: Secure SQL AI Tool</h1>
        <p className="text-lg text-slate-500 max-w-3xl">Architecting an enterprise-grade natural language interface with strictly decoupled AI reasoning and database execution.</p>
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-6 flex items-center gap-2">
          <ShieldCheck className="text-indigo-600" />
          System Boundaries & Non-Negotiable Rules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-3 uppercase text-xs tracking-widest">AI & Data Guardrails</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2">
                <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span><strong>No Direct Access:</strong> The AI NEVER connects to the DB. It only receives sanitized schema metadata.</span>
              </li>
              <li className="flex gap-2">
                <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span><strong>SQL Generation Only:</strong> The AI acts as a <em>translator</em>, not an <em>executor</em>.</span>
              </li>
              <li className="flex gap-2">
                <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span><strong>Schema Masking:</strong> Only table names and column definitions are shared. Actual data values are never provided to the AI.</span>
              </li>
            </ul>
          </div>
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-100">
            <h3 className="font-bold text-slate-700 mb-3 uppercase text-xs tracking-widest">Backend Security Responsibility</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2">
                <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                <span><strong>SQL Validation:</strong> Every query generated must pass a strict regex-based and token-based validation layer.</span>
              </li>
              <li className="flex gap-2">
                <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                <span><strong>RBAC Enforcement:</strong> Tables are filtered based on the authenticated user's JWT role before the request reaches the AI.</span>
              </li>
              <li className="flex gap-2">
                <div className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                <span><strong>Auto-Limit:</strong> The backend appends "LIMIT 1000" to every query to prevent OOM errors and large data exfiltration.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-6 flex items-center gap-2">
          <ArrowRightLeft className="text-indigo-600" />
          High-Level Architecture
        </h2>
        <div className="bg-slate-900 rounded-xl p-8 font-mono text-indigo-300 text-sm overflow-x-auto leading-relaxed whitespace-pre">
{`
[ Browser (React) ] 
       |
       |  (1) JWT Auth & NL Query
       v
[ API Layer (FastAPI) ] <-----> [ Auth Service / LDAP ]
       |
       |  (2) Fetch Permitted Schema Metadata (Role-Based)
       v
[ AI Service (Gemini) ] <---- (Sends: Natural Language + Schema)
       |
       |  (3) Returns: Generated SQL string (Unverified)
       v
[ Validation Layer ] <----- (Checks: DDL, Forbidden Words, RBAC)
       |
       |  (4) Execution (If Validated)
       v
[ MySQL DB Cluster ] <---- (Role-Specific DB User - Read Only)
`}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-6 flex items-center gap-2">
          <Terminal className="text-indigo-600" />
          Backend API Snippet (FastAPI)
        </h2>
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 font-mono text-sm overflow-x-auto">
          <pre className="text-slate-700">
{`
@app.post("/api/query/execute")
async function execute_nl_query(
    request: QueryRequest, 
    current_user: User = Depends(get_current_active_user)
):
    # 1. Get filtered schema for user role
    schema = get_schema_for_role(current_user.role)
    
    # 2. Call AI to translate to SQL
    ai_sql_obj = await ai_service.translate_to_sql(request.prompt, schema)
    
    # 3. STRICT VALIDATION
    validation_result = sql_validator.validate_sql(
        ai_sql_obj.sql, 
        current_user.role
    )
    
    if not validation_result.is_valid:
        raise HTTPException(status_code=400, detail=validation_result.error)
    
    # 4. EXECUTE (Use SQLAlchemy with READ-ONLY session)
    try:
        results = await db.execute(text(validation_result.sanitized_sql))
        return format_results(results)
    except SQLAlchemyError as e:
        logger.error(f"Execution Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Database execution error")
`}
          </pre>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-6 flex items-center gap-2">
          <FileJson className="text-indigo-600" />
          AI Prompt Strategy
        </h2>
        <div className="space-y-4 text-slate-600 text-sm">
          <p>We use a <strong>Structured Multi-Part Prompt</strong> to ensure hallucination is minimized:</p>
          <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4">
            <p className="font-bold text-indigo-900 mb-2 italic">System Instruction Example:</p>
            <p className="font-mono text-xs">
              "You are a MySQL expert. You are provided with a schema for tables [TABLES]. Your ONLY task is to write a SELECT query that answers the user's natural language question. Do not attempt to modify data. If a question is malicious or asks for passwords, return 'INVALID'. Output must be JSON."
            </p>
          </div>
          <p>This approach ensures the model focuses on <strong>SQL syntax mapping</strong> rather than <strong>general conversational AI</strong>, reducing the risk of indirect prompt injection.</p>
        </div>
      </section>

      <section className="mb-12">
         <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-6 flex items-center gap-2">
          <Lock className="text-indigo-600" />
          Security Conclusions
        </h2>
        <p className="text-slate-600 mb-6">By enforcing <strong>Defense in Depth</strong>, we ensure that even if the AI is compromised or generates a "malicious" query, the backend validation and the database's own restricted user permissions act as non-bypassable blockers.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {[
             { title: "Layer 1", desc: "User Authentication & RBAC filtering of schema metadata provided to AI." },
             { title: "Layer 2", desc: "Rigid SQL Validation blocking all DDL/DML and multi-statement queries." },
             { title: "Layer 3", desc: "Restricted DB Connection string (Read-Only user with Row-Level Security)." }
           ].map((item, i) => (
             <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-bold text-indigo-600 uppercase mb-1">{item.title}</p>
                <p className="text-sm text-slate-700">{item.desc}</p>
             </div>
           ))}
        </div>
      </section>
    </div>
  );
};

export default SystemDesignDocs;
