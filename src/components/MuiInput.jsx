import { InputAdornment, TextField } from "@mui/material";

const MuiInput = ({
  label,
  icon: Icon,
  value,
  onChange,
  type = "text",
  min,
  max,
  fullWidth = true,
}) => {
  return (
    <TextField
      label={label}
      variant="outlined"
      type={type}
      value={value}
      onChange={onChange}
      fullWidth={fullWidth}
      size="small"
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Icon size={18} color="action" />
          </InputAdornment>
        ),
        inputProps: {
          min: min,
          max: max,
        },
      }}
      sx={{
        "& .MuiOutlinedInput-root": {
          borderRadius: 2,
          backgroundColor: "white",
          "&.Mui-focused fieldset": {
            borderColor: "#D32F2F",
            boxShadow: "0 0 0 2px rgba(211,47,47,0.2)",
          },
        },
      }}
    />
  );
};

export default MuiInput;
