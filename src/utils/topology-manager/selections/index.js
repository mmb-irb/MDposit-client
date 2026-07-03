// Set a class to standarize atom selections
export class Selection {
    // Constructor expects atom indices only
    constructor(atomIndices) {
        this.atomIndices = new Set(atomIndices);
    }
}