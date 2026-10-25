// Create an error that the shared errorHandler turns into a JSON response with this status.
function httpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

module.exports = httpError;
