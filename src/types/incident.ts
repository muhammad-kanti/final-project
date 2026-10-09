export type EmergencyType =
  | "medical"
  | "fire"
  | "accident"
  | "theft"
  | "assault"
  | "other";

export type IncidentStatus = "pending" | "acknowledged" | "in_progress" | "resolved" | "false_alarm";

export type LocationSource = "device_gps" | "geocode" | "manual";

export interface GeoCoords {
  lat: number;
  lng: number;
  accuracy?: number | null;
}

export interface IncidentLocation {
  coords: GeoCoords | null;
  address: string | null;
  description: string | null;
  source: LocationSource;
}

export interface Incident {
  id: string;
  emergencyType: EmergencyType;
  description: string | null;
  location: IncidentLocation;
  ownerId: string | null; // null for anonymous reports (admin-only deletion)
  reportedBy: string | null; // name/student id optional
  contact: string | null;
  status: IncidentStatus;
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string; // ISO
  updatedAt: string; // ISO
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  assignedTo: string | null;
  notes: string[];
}

export interface CreateIncidentInput {
  emergencyType: EmergencyType;
  description?: string | null;
  location: IncidentLocation;
  reportedBy?: string | null;
  contact?: string | null;
  priority?: Incident["priority"];
}

export interface UpdateIncidentInput {
  status?: IncidentStatus;
  priority?: Incident["priority"];
  assignedTo?: string | null;
  notes?: string[];
  location?: Partial<IncidentLocation>;
  description?: string | null;
  contact?: string | null;
}
