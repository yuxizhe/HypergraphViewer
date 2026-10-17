export const formatDescription = (description) => {
    if (!description) return "";
    return description.split("<SEP>").join(" ");
};
