import DataUnavailable from "../../components/DataUnavailable";

export default function WorkspacePage() {
  return <div className="module-page users-page">
    <header className="page-header">
      <div>
        <h1>Users</h1>
        <p>Platform accounts and roles</p>
      </div>
    </header>
    <DataUnavailable
      title="User directory is not connected"
      description="This project can authenticate existing accounts, but it has no administrator API for listing or creating users. Account totals and directory entries are not displayed without a verified source."
      sources={["Administrator user directory API"]}
    />
  </div>;
}
