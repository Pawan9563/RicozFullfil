import React, { useEffect, useState } from "react";
import { userAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import DataTable from "../../components/ui/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/forms/Button";
import Select from "../../components/forms/Select";

const ROLES = ["ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER", "PICKER", "PACKER"];

export const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
  const [users, setUsers] = useState([]);
  const [roleEdits, setRoleEdits] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await userAPI.getAll({ page: 1, limit: 100 });
      const rows = response?.data?.users || [];
      setUsers(rows);
      setRoleEdits(Object.fromEntries(rows.map((row) => [row._id, row.role])));
      setError("");
    } catch (err) { setError(err?.message || "Unable to load users."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadUsers(); }, []);

  const updateRole = async (row) => {
    const role = roleEdits[row._id];
    if (!role || role === row.role) return;
    if (row._id === currentUser?._id && role !== currentUser.role) { setError("You cannot change your own role."); return; }
    setSavingId(row._id); setError(""); setNotice("");
    try {
      const response = await userAPI.updateRole(row._id, role);
      const updated = response?.data?.user || response?.data;
      setUsers((current) => current.map((entry) => entry._id === row._id ? { ...entry, ...updated, role } : entry));
      setNotice(`Role updated for ${row.name}.`);
    } catch (err) { setError(err?.message || "Unable to update role."); }
    finally { setSavingId(""); }
  };
  const toggleStatus = async (row) => {
    setSavingId(row._id); setError(""); setNotice("");
    try {
      const response = await userAPI.toggleStatus(row._id);
      const updated = response?.data?.user || response?.data;
      setUsers((current) => current.map((entry) => entry._id === row._id ? { ...entry, ...updated } : entry));
      setNotice(`Account ${updated?.isActive ? "activated" : "deactivated"} for ${row.name}.`);
    } catch (err) { setError(err?.message || "Unable to update account status."); }
    finally { setSavingId(""); }
  };

  const columns = [
    { header: "Name", accessor: "name" }, { header: "Email", accessor: "email" },
    { header: "Role", accessor: "role", render: (row) => <div className="role-editor"><StatusBadge status={row.role} /><Select id={`role-${row._id}`} aria-label={`Role for ${row.name}`} value={roleEdits[row._id] || row.role} disabled={row.role === "SUPER_ADMIN" && !isSuperAdmin} onChange={(event) => setRoleEdits({ ...roleEdits, [row._id]: event.target.value })} options={[...(isSuperAdmin ? ["SUPER_ADMIN"] : []), ...ROLES].map((role) => ({ value: role, label: role.replaceAll("_", " ") }))} /><Button variant="outline" disabled={savingId === row._id || roleEdits[row._id] === row.role || (row._id === currentUser?._id)} onClick={() => updateRole(row)}>{savingId === row._id ? "Saving…" : "Save role"}</Button></div> },
    { header: "Phone", accessor: "phone", render: (row) => row.phone || "—" },
    { header: "Status", accessor: "isActive", render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} /> },
    { header: "Account", accessor: "_id", render: (row) => <Button variant="outline" disabled={savingId === row._id || row._id === currentUser?._id} onClick={() => toggleStatus(row)}>{row.isActive ? "Deactivate" : "Activate"}</Button> },
  ];

  return <div><div className="page-header"><div><h1 className="page-title">User & Role Management</h1><p className="page-subtitle">Manage staff access and account status</p></div></div>{error && <div className="error-banner" role="alert">{error}</div>}{notice && <div className="success-banner" role="status">{notice}</div>}<section className="card">{loading ? <p role="status">Loading users…</p> : <DataTable columns={columns} data={users} />}</section></div>;
};

export default UserManagement;
