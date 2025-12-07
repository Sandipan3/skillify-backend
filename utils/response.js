export const sendSuccessResponse = (res, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    status: "success",
    data,
  });
};

export const sendErrorResponse = (
  res,
  message = "Something went wrong !",
  statusCode = 500
) => {
  return res.status(statusCode).json({
    status: "error",
    message,
  });
};
