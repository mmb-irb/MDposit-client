import chroma from 'chroma-js';

// Createa a copy from an object thus not conserving any pointer to the original object contents
export const copyObject = object => JSON.parse(JSON.stringify(object));

// Get the average from a list of values
export const caluclateAverage = values => {
    const addition = values.reduce((acc, curr) => acc + curr, 0);
    return addition / values.length;
}

// Round a number to its neares cent
export const round2cents = number => Math.round(number * 100) / 100;

// Count the number of specific elements in an array
export const countElement = (array, target) => array.reduce((total, value) => value == target ? total + 1: total, 0);

// Create palettes of random spaced colors
export const createPalette = colorCount => {
    const colors = [];
    for (let i = 0; i < colorCount; i++) {
        const color = chroma.hcl(i / colorCount * 360, 80, 70).css();
        colors.push(color);
    }
    return colors;
};

// Join 2 ArrayBuffer
// https://stackoverflow.com/questions/10786128/appending-arraybuffers
export const appendBuffer = (buffer1, buffer2) => {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
}

export class Version {
    constructor (versionString) {
        // If there is no version then consider it the 0.0.0
        if (versionString === undefined) versionString = '0.0.0';
        // Get the major, minor and patch versions
        const splits = versionString.split('.');
        this.major = splits[0] && +splits[0];
        this.minor = splits[1] && +splits[1];
        this.patch = splits[2] && +splits[2];
    }

    // Get the version back in string format
    // This has also an effect in the console-log display
    toString () {
        let string = this.major.toString();
        if (this.minor === undefined) return string;
        string += '.' + this.minor.toString();
        if (this.patch === undefined) return string;
        string += '.' + this.patch.toString();
        return string;
    }

    // Check if two versions are equal
    equals (other) {
        // If this is a string instead of a version the parse it
        if (typeof other === 'string') return this.equals(new Version(other));
        // Check if versions are equal for all major, minor and patch versions
        // If other version has not explicit patch or minor version then they are not compared
        if (other.major !== this.major) return false;
        if (other.minor !== undefined && other.minor !== this.minor) return false;
        if (other.patch !== undefined && other.patch !== this.patch) return false;
        return true;
    }
}