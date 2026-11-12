import { HttpContextToken } from '@angular/common/http';

/** A 404 is expected when checking whether an optional related resource exists. */
export const OPTIONAL_RESOURCE = new HttpContextToken<boolean>(() => false);
