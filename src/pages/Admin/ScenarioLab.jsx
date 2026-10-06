import { useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, CircleAlert, FlaskConical, Info, Plus, Star, X } from "lucide-react";
import "./ScenarioLab.css";

const initialScenarios = [
  { name: "CSE Block Closure", description: "Building Closure · 42 classes affected · 7 conflicts", impact: "High", detail: "Simulate closing the CSE block for scheduled maintenance. The model identified 42 affected classes and 7 scheduling conflicts.", building: "CSE Block", duration: "1 day" },
  { name: "Annual Tech Fest", description: "Large Event · 850 attendees · 76% feasibility", impact: "Medium", detail: "Estimate campus capacity and service readiness for the annual technology festival with 850 expected attendees.", building: "Campus-wide", duration: "3 days" },
  { name: "Lab Maintenance Shutdown", description: "Maintenance Shutdown · 6 classes affected · 3 alternatives", impact: "Low", detail: "Review alternative room assignments during the planned laboratory maintenance shutdown.", building: "Engineering Labs", duration: "2 days" },
];

function ImpactBadge({ level }) {
  return <span className={`scenario-impact ${level.toLowerCase()}`}>{level.toUpperCase()}</span>;
}

function ScenarioLab() {
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [dialog, setDialog] = useState(false);
  const [selected, setSelected] = useState(null);
  const count = useMemo(() => scenarios.length, [scenarios]);

  function addScenario(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = {
      name: form.get("name"),
      description: `${form.get("type")} · ${form.get("duration")} · Ready to simulate`,
      impact: form.get("impact"),
      detail: `Scenario created for ${form.get("building")} over ${form.get("duration")}. Run a simulation to review the estimated impact before making changes.`,
      building: form.get("building"),
      duration: form.get("duration"),
    };
    setScenarios((items) => [item, ...items]);
    setDialog(false);
  }

  return <div className="scenario-page">
    <header className="scenario-heading"><div><h1><FlaskConical size={22}/> Campus Scenario Lab</h1><p>Simulate campus changes and evaluate their impact before making decisions.</p></div><button className="scenario-new-button" onClick={() => setDialog(true)}><Plus size={17}/> New Scenario</button></header>

    <section className="scenario-metrics" aria-label="Scenario summary">
      <article className="scenario-metric"><span>Scenarios Tested</span><i className="cyan"><FlaskConical size={17}/></i><strong>{12 + Math.max(0, scenarios.length - 3)}</strong><small>All time</small></article>
      <article className="scenario-metric"><span>High Impact</span><i className="red"><CircleAlert size={17}/></i><strong>3</strong><small>Requires action</small></article>
      <article className="scenario-metric"><span>Conflicts Identified</span><i className="amber"><AlertTriangle size={17}/></i><strong>27</strong><small>Across scenarios</small></article>
      <article className="scenario-metric"><span>Optimization Opportunities</span><i className="green"><Star size={17}/></i><strong>18</strong><small>Resolvable</small></article>
    </section>

    <section className="scenario-list-panel"><header className="scenario-list-heading"><h2>Recent Scenarios</h2><span>{count} scenarios</span></header>
      <div className="scenario-rows">{scenarios.map((scenario, index) => <button className="scenario-row" key={`${scenario.name}-${index}`} onClick={() => setSelected(scenario)}>
        <span className={`scenario-row-icon ${scenario.impact.toLowerCase()}`}><FlaskConical size={19}/></span><span className="scenario-row-copy"><strong>{scenario.name}</strong><small>{scenario.description}</small></span><ImpactBadge level={scenario.impact}/><ChevronRight className="scenario-row-arrow" size={17}/>
      </button>)}</div>
    </section>

    <aside className="scenario-simulation-note"><Info size={17}/><div><strong>Simulation Mode</strong><p>Scenarios run in a safe, isolated environment. No real campus systems or schedules are changed.</p></div></aside>

    {dialog && <div className="scenario-overlay" onMouseDown={(event) => event.target === event.currentTarget && setDialog(false)}><form className="scenario-dialog" onSubmit={addScenario}>
      <button className="scenario-dialog-close" type="button" aria-label="Close" onClick={() => setDialog(false)}><X size={18}/></button><span className="scenario-dialog-icon"><FlaskConical size={19}/></span><h2>New Scenario</h2><p>Model a possible change and review its campus impact.</p>
      <label>Scenario name<input name="name" required placeholder="e.g. Library extended hours"/></label>
      <label>Scenario type<select name="type" defaultValue="Building Closure"><option>Building Closure</option><option>Large Event</option><option>Maintenance Shutdown</option><option>Schedule Change</option><option>Energy Optimization</option></select></label>
      <div className="scenario-form-row"><label>Campus area<select name="building" defaultValue="Campus-wide"><option>Campus-wide</option><option>CSE Block</option><option>Mechanical Block</option><option>Central Library</option><option>Engineering Labs</option></select></label><label>Duration<select name="duration" defaultValue="1 day"><option>1 day</option><option>2 days</option><option>3 days</option><option>1 week</option></select></label></div>
      <label>Expected impact<select name="impact" defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option></select></label>
      <div className="scenario-dialog-actions"><button type="button" onClick={() => setDialog(false)}>Cancel</button><button type="submit">Create Scenario</button></div>
    </form></div>}

    {selected && <div className="scenario-overlay" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}><section className="scenario-dialog scenario-detail-dialog">
      <button className="scenario-dialog-close" type="button" aria-label="Close" onClick={() => setSelected(null)}><X size={18}/></button><span className={`scenario-dialog-icon ${selected.impact.toLowerCase()}`}><FlaskConical size={19}/></span><div className="scenario-detail-title"><h2>{selected.name}</h2><ImpactBadge level={selected.impact}/></div><p>{selected.detail}</p><dl><div><dt>Campus area</dt><dd>{selected.building}</dd></div><div><dt>Duration</dt><dd>{selected.duration}</dd></div><div><dt>Simulation status</dt><dd>Ready to simulate</dd></div></dl><div className="scenario-dialog-actions"><button onClick={() => setSelected(null)}>Close</button><button onClick={() => { setSelected(null); setDialog(true); }}>Create another</button></div>
    </section></div>}
  </div>;
}

export default ScenarioLab;
