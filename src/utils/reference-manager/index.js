// Constants
import { BASE_VERSIONED_PATH, REFERENCES } from 'src/utils/constants';
// Version handler
import Version from 'src/utils/version';

export class Reference {
  constructor(type, data) {
    // Save the inputs
    this.type = type;
    this.data = data;
    // Get some additional values from the database
    const config = REFERENCES[this.type];
    if (!config) throw new Error(`Unknown reference type "${this.type}"`);
    this.idField = config.idField;
    this.id = this.data[this.idField];
    this.projectIdsField = config.projectIdsField;
    // Parse those values which point to reference files in the database
    Object.entries(this.data).forEach(([field, value]) => {
        if (typeof value !== 'string') return;
        if (!value.startsWith('file:')) return;
        const filename = value.slice(5);
        this.data[field] = `${BASE_VERSIONED_PATH}/references/${this.type}/${this.id}/files/${filename}`;
    })
    // Copy all data values in this instance directly soy thet are more accessible
    Object.entries(this.data).forEach(([field, value]) => { this[field] = value });
    // Parse the version
    this.version = new Version(this.data.version);
  }

  toString = () => `"${this.type}" reference "${this.id}"`;
}