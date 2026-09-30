import { type State } from "../services/api";
export function Audit({ state }: { state: State }) {
  return (
    <section className="panel audit-panel">
      <div className="panel-heading">
        <div>
          <h2>Audit trail</h2>
          <p>An accountable record of important workspace actions.</p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Action</th>
              <th>User</th>
              <th>Details</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {state.audit.slice(0, 30).map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.type}</strong>
                </td>
                <td>
                  {state.employees.find((p) => p.id === e.employeeId)?.name ||
                    "System"}
                </td>
                <td>{e.description}</td>
                <td>{new Date(e.createdAt).toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
