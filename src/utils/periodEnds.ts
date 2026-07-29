import { addDays, addMonths, addYears, subDays } from "date-fns";
import { BillingCycle } from "../generated/prisma/enums.js";

export function getEndPeriod(
  startDate: Date,
  billingCycle: BillingCycle,
): Date {
  switch (billingCycle) {
    case "MONTHLY":
      return subDays(addMonths(startDate, 1), 1);

    case "QUARTERLY":
      return subDays(addMonths(startDate, 3), 1);

    case "BIANNUALLY":
      return subDays(addMonths(startDate, 6), 1);

    case "ANNUALLY":
      return subDays(addYears(startDate, 1), 1);

    default:
      return subDays(addDays(startDate, 14), 1);
  }
}
