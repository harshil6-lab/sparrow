/**
 * The setup option sets, shared by SetupScreen and Profile > My Nest so the two
 * screens can never drift. `label` is the value stored in profile.answers;
 * `labelKey` is the i18n key shown to the user.
 */
import type { IconName } from "../components/Icon";
import type { HomeType } from "./types";

export interface HomeOption {
  key: string;
  labelKey: string;
  value: HomeType;
  icon: IconName;
}

export interface SetupOption {
  label: string;
  labelKey: string;
  icon: IconName;
}

export const HOME_OPTIONS: HomeOption[] = [
  { key: "apartment", labelKey: "setup.homeApartment", value: "apartment", icon: "apartment" },
  { key: "independent", labelKey: "setup.homeIndependent", value: "independent", icon: "home" },
  { key: "row", labelKey: "setup.homeRow", value: "row", icon: "row" },
];

export const PEOPLE_OPTIONS: SetupOption[] = [
  { label: "Just me", labelKey: "setup.people1", icon: "people1" },
  { label: "2 people", labelKey: "setup.people2", icon: "people2" },
  { label: "3–4 people", labelKey: "setup.people4", icon: "people4" },
  { label: "5+ people", labelKey: "setup.people5", icon: "people5" },
];

export const BILL_OPTIONS: SetupOption[] = [
  { label: "Under ₹1,000", labelKey: "setup.billUnder1k", icon: "coin1" },
  { label: "₹1,000–2,500", labelKey: "setup.bill1k2_5k", icon: "coin2" },
  { label: "₹2,500–5,000", labelKey: "setup.bill2_5k5k", icon: "coin3" },
  { label: "Over ₹5,000", labelKey: "setup.billOver5k", icon: "coin4" },
];

export const APPLIANCE_OPTIONS: SetupOption[] = [
  { label: "Air conditioner", labelKey: "setup.applianceAc", icon: "ac" },
  { label: "Geyser", labelKey: "setup.applianceGeyser", icon: "geyser" },
  { label: "Washing machine", labelKey: "setup.applianceWasher", icon: "washer" },
  { label: "Refrigerator", labelKey: "setup.applianceFridge", icon: "fridge" },
  { label: "Water pump", labelKey: "setup.appliancePump", icon: "pump" },
  { label: "Induction", labelKey: "setup.applianceInduction", icon: "induction" },
];
